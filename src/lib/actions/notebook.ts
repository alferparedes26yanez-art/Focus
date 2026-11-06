"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { generateJson } from "@/lib/ai/client";
import { AiError } from "@/lib/ai/errors";
import { pagesTranscriptionPrompt } from "@/lib/ai/prompts";
import { requireUser } from "@/lib/auth";
import type { Json } from "@/types/database";
import { pagesTranscriptSchema } from "@/lib/materials/schemas";
import {
  MAX_NOTEBOOK_DOC_CHARS,
  NOTEBOOK_BUCKET,
  notebookDocSchema,
  notebookImagePaths,
  notebookPlainText,
  UNTITLED_PAGE,
} from "@/lib/notebook/document";
import { removeNotebookPageFiles } from "@/lib/notebook/storage";

import type { ActionResult } from "./types";

const idSchema = z.uuid();

// Pages created and left untouched for a while are not kept.
const UNTOUCHED_PAGE_MS = 10 * 60 * 1000;

export async function createNotebookPage(subjectId: string): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) return { ok: false, error: "Materia no válida." };

  await supabase
    .from("notebook_pages")
    .delete()
    .eq("subject_id", subjectId)
    .eq("title", UNTITLED_PAGE)
    .eq("plain_text", "")
    .lt("updated_at", new Date(Date.now() - UNTOUCHED_PAGE_MS).toISOString());

  const { data, error } = await supabase
    .from("notebook_pages")
    .insert({ subject_id: subjectId, title: UNTITLED_PAGE })
    .select("id")
    .single();
  if (error) return { ok: false, error: "No se pudo crear la página. Inténtalo de nuevo." };
  return { ok: true, data: { id: data.id } };
}

const patchSchema = z.object({
  content: z.unknown().optional(),
  title: z.string().trim().min(1, "Escribe un título.").max(200).optional(),
  classDate: z.iso.date().optional(),
  topicId: z.uuid().nullable().optional(),
});

export type NotebookPatch = z.input<typeof patchSchema>;

// Saves part of a page. `expectedUpdatedAt` is the version the editor
// started from: if the page changed elsewhere (another tab or device), the
// save is refused instead of overwriting that work.
export async function saveNotebookPage(
  pageId: string,
  patch: NotebookPatch,
  expectedUpdatedAt: string,
): Promise<ActionResult<{ updatedAt: string }> & { conflict?: boolean }> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Página no válida." };
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };

  const update: { content?: NonNullable<Json>; plain_text?: string; title?: string; class_date?: string; topic_id?: string | null } = {};
  if (parsed.data.content !== undefined) {
    if (JSON.stringify(parsed.data.content).length > MAX_NOTEBOOK_DOC_CHARS) {
      return { ok: false, error: "La página es demasiado larga. Divídela en dos páginas." };
    }
    const doc = notebookDocSchema.safeParse(parsed.data.content);
    if (!doc.success) return { ok: false, error: "El contenido de la página no es válido." };
    update.content = doc.data as NonNullable<Json>;
    // A page with only images is not empty (it keeps it out of the cleanup below).
    update.plain_text = (notebookPlainText(doc.data) || (notebookImagePaths(doc.data).length > 0 ? "[Imagen]" : "")).slice(0, 300_000);
  }
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.classDate !== undefined) update.class_date = parsed.data.classDate;
  if (parsed.data.topicId !== undefined) update.topic_id = parsed.data.topicId;

  const { data, error } = await supabase
    .from("notebook_pages")
    .update(update)
    .eq("id", pageId)
    .eq("updated_at", expectedUpdatedAt)
    .select("updated_at")
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      error: error.message.includes("topic_not_in_subject") ? "Ese tema es de otra materia." : "No se pudo guardar.",
    };
  }
  if (!data) {
    const { data: exists } = await supabase.from("notebook_pages").select("id").eq("id", pageId).maybeSingle();
    return exists
      ? { ok: false, conflict: true, error: "Esta página cambió en otra pestaña o dispositivo. Recarga para ver la última versión." }
      : { ok: false, error: "Esta página ya no existe." };
  }
  return { ok: true, data: { updatedAt: data.updated_at } };
}

export async function deleteNotebookPage(pageId: string): Promise<ActionResult<{ subjectId: string }>> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(pageId).success) return { ok: false, error: "Página no válida." };

  const { data: page } = await supabase.from("notebook_pages").select("subject_id").eq("id", pageId).maybeSingle();
  if (!page) return { ok: false, error: "Esta página ya no existe." };
  if (!(await removeNotebookPageFiles(supabase, userId, page.subject_id, pageId))) {
    return { ok: false, error: "No se pudieron borrar las imágenes de la página. Inténtalo de nuevo." };
  }
  // Its library entry and search fragments go with it (foreign key cascade).
  const { error } = await supabase.from("notebook_pages").delete().eq("id", pageId);
  if (error) return { ok: false, error: "No se pudo borrar la página." };
  refresh();
  return { ok: true, data: { subjectId: page.subject_id } };
}

const MAX_IMAGE_TEXT = 3000;

// Reads the text of a photo pasted in the notebook (board, slide, book) so the
// page can be searched by it. Returns "" when there is nothing to read.
export async function readNotebookImage(path: string): Promise<ActionResult<{ text: string }>> {
  const { supabase, userId } = await requireUser();
  if (!path.startsWith(`${userId}/`) || path.includes("..") || path.length > 500) {
    return { ok: false, error: "Imagen no válida." };
  }

  const { data: file, error } = await supabase.storage.from(NOTEBOOK_BUCKET).download(path);
  if (error || !file) return { ok: false, error: "No se pudo leer la imagen." };

  try {
    const prompt = pagesTranscriptionPrompt({ count: 1, source: "photos" });
    const output = await generateJson({
      feature: "notebook_images",
      tier: "fast",
      userId,
      schema: pagesTranscriptSchema,
      systemInstruction: prompt.systemInstruction,
      parts: [
        { inlineData: { mimeType: file.type || "image/jpeg", data: Buffer.from(await file.arrayBuffer()).toString("base64") } },
        { text: prompt.instruction },
      ],
      maxOutputTokens: 4_096,
      deadline: Date.now() + 40_000,
    });
    const text = output.pages.map((page) => page.text.trim()).join("\n").trim().slice(0, MAX_IMAGE_TEXT);
    return { ok: true, data: { text } };
  } catch (aiError) {
    if (aiError instanceof AiError) return { ok: false, error: aiError.userMessage };
    console.error("[notebook] image reading failed:", aiError);
    return { ok: false, error: "No se pudo leer la imagen." };
  }
}
