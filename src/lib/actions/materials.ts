"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getBudgetStatus } from "@/lib/ai/budget";
import { getModel } from "@/lib/ai/client";
import { AiError } from "@/lib/ai/errors";
import { estimateVideoCostUsd } from "@/lib/ai/pricing";
import { requireUser } from "@/lib/auth";
import { assertPublicUrl, WebPageError, webPlaceholderTitle } from "@/lib/materials/extract/web";
import {
  fetchYoutubeInfo,
  MAX_VIDEO_SECONDS,
  parseYoutubeId,
  VIDEO_SEGMENT_SECONDS,
  youtubeWatchUrl,
} from "@/lib/materials/extract/youtube";
import { planMaterials, storageFileName, type SelectedMaterialFile } from "@/lib/materials/files";
import { removeMaterialFiles } from "@/lib/materials/storage";
import type { StoredFile } from "@/lib/syllabus/prepare-files";
import type { ServerSupabase } from "@/lib/supabase/server";

import type { ActionResult } from "./types";

const idSchema = z.uuid();

// Where new material is filed: chosen topic, the whole subject, or let the AI
// decide (it waits for a syllabus if the subject has no topics yet).
const topicChoiceSchema = z.union([z.literal("auto"), z.literal("general"), z.uuid()]);
export type TopicChoice = z.infer<typeof topicChoiceSchema>;

function topicFields(choice: TopicChoice) {
  if (choice === "auto") return { topic_id: null, topic_source: "pending" as const };
  if (choice === "general") return { topic_id: null, topic_source: "general" as const };
  return { topic_id: choice, topic_source: "user" as const };
}

// The topic trigger rejects topics of another subject; RLS hides other users'.
async function checkTopic(supabase: ServerSupabase, subjectId: string, choice: TopicChoice) {
  if (choice === "auto" || choice === "general") return true;
  const { data } = await supabase.from("topics").select("id, units!inner(subject_id)").eq("id", choice).maybeSingle();
  return data?.units.subject_id === subjectId;
}

async function subjectExists(supabase: ServerSupabase, subjectId: string) {
  const { data } = await supabase.from("subjects").select("id").eq("id", subjectId).maybeSingle();
  return Boolean(data);
}

// Uploads abandoned more than an hour ago (tab closed) are cleaned up.
const STALE_UPLOAD_MS = 60 * 60 * 1000;

async function removeStaleUploads(supabase: ServerSupabase, subjectId: string) {
  const { data } = await supabase
    .from("materials")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("status", "uploading")
    .lt("created_at", new Date(Date.now() - STALE_UPLOAD_MS).toISOString());
  if (!data || data.length === 0) return;
  const ids = data.map((row) => row.id);
  if (await removeMaterialFiles(supabase, { materialIds: ids })) {
    await supabase.from("materials").delete().in("id", ids);
  }
}

// Step 1 of an upload: plan the materials and reserve their Storage paths. The
// browser uploads the files directly to Storage and then calls finishUploads.
export async function createMaterials(
  subjectId: string,
  files: SelectedMaterialFile[],
  options: { topic: TopicChoice; groupPhotos: boolean; photosTitle?: string },
): Promise<
  ActionResult<{
    materials: { id: string; title: string; uploads: { path: string; mimeType: string; fileIndex: number }[] }[];
  }>
> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) return { ok: false, error: "Materia no válida." };

  const selected = z
    .array(z.object({ name: z.string().min(1).max(255), size: z.number(), type: z.string().max(200) }))
    .safeParse(files);
  const settings = z
    .object({ topic: topicChoiceSchema, groupPhotos: z.boolean(), photosTitle: z.string().max(300).optional() })
    .safeParse(options);
  if (!selected.success || !settings.success) return { ok: false, error: "Archivos no válidos." };

  const plan = planMaterials(selected.data, settings.data);
  if (!plan.ok) return { ok: false, error: plan.error };
  if (!(await subjectExists(supabase, subjectId))) return { ok: false, error: "No encontramos esta materia." };
  if (!(await checkTopic(supabase, subjectId, settings.data.topic))) {
    return { ok: false, error: "Ese tema ya no existe. Elige otro." };
  }

  await removeStaleUploads(supabase, subjectId);

  const rows = plan.materials.map((material) => {
    const id = crypto.randomUUID();
    const stored: (StoredFile & { fileIndex: number })[] = material.files.map((file, position) => ({
      path: `${userId}/${subjectId}/${id}/${position + 1}-${storageFileName(file.name, file.mimeType)}`,
      name: file.name.slice(0, 255),
      mime_type: file.mimeType,
      size: file.size,
      fileIndex: file.index,
    }));
    return { id, kind: material.kind, title: material.title, stored };
  });

  const { error } = await supabase.from("materials").insert(
    rows.map((row) => ({
      id: row.id,
      subject_id: subjectId,
      ...topicFields(settings.data.topic),
      kind: row.kind,
      title: row.title,
      files: row.stored.map((file) => ({
        path: file.path,
        name: file.name,
        mime_type: file.mime_type,
        size: file.size,
      })),
      status: "uploading",
      total_units: row.kind === "images" ? row.stored.length : null,
    })),
  );
  if (error) {
    console.error("[materials] insert failed:", error.message);
    return { ok: false, error: "No se pudo preparar la subida. Inténtalo de nuevo." };
  }

  return {
    ok: true,
    data: {
      materials: rows.map((row) => ({
        id: row.id,
        title: row.title,
        uploads: row.stored.map((file) => ({ path: file.path, mimeType: file.mime_type, fileIndex: file.fileIndex })),
      })),
    },
  };
}

const idListSchema = z.array(z.uuid()).min(1).max(50);

// Step 2: the files are in Storage, the materials can be read.
export async function finishUploads(materialIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ids = idListSchema.safeParse(materialIds);
  if (!ids.success) return { ok: false, error: "Material no válido." };

  const { error } = await supabase
    .from("materials")
    .update({ status: "queued" })
    .in("id", ids.data)
    .eq("status", "uploading");
  if (error) return { ok: false, error: "No se pudo guardar el material. Inténtalo de nuevo." };

  refresh();
  return { ok: true };
}

// An upload failed in the browser: forget those materials.
export async function cancelUploads(materialIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ids = idListSchema.safeParse(materialIds);
  if (!ids.success) return { ok: false, error: "Material no válido." };

  const { data } = await supabase.from("materials").select("id").in("id", ids.data).eq("status", "uploading");
  const pending = (data ?? []).map((row) => row.id);
  if (pending.length > 0 && (await removeMaterialFiles(supabase, { materialIds: pending }))) {
    await supabase.from("materials").delete().in("id", pending);
  }
  refresh();
  return { ok: true };
}

async function isDuplicateLink(supabase: ServerSupabase, subjectId: string, url: string) {
  const { count } = await supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subjectId)
    .eq("source_url", url);
  return (count ?? 0) > 0;
}

export async function addWebMaterial(
  subjectId: string,
  rawUrl: string,
  topic: TopicChoice,
): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) return { ok: false, error: "Materia no válida." };
  const choice = topicChoiceSchema.safeParse(topic);
  if (!choice.success) return { ok: false, error: "Tema no válido." };

  const value = rawUrl.trim();
  if (!value || value.length > 2000) return { ok: false, error: "Pega el enlace de la página." };
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  if (parseYoutubeId(withProtocol)) {
    return { ok: false, error: "Es un video de YouTube: agrégalo con la opción «Video de YouTube»." };
  }

  let url: URL;
  try {
    url = await assertPublicUrl(withProtocol);
  } catch (error) {
    return { ok: false, error: error instanceof WebPageError ? error.message : "El enlace no es válido." };
  }
  url.hash = "";
  const sourceUrl = url.toString();

  if (!(await subjectExists(supabase, subjectId))) return { ok: false, error: "No encontramos esta materia." };
  if (!(await checkTopic(supabase, subjectId, choice.data))) {
    return { ok: false, error: "Ese tema ya no existe. Elige otro." };
  }
  if (await isDuplicateLink(supabase, subjectId, sourceUrl)) {
    return { ok: false, error: "Ese enlace ya está en el material de esta materia." };
  }

  const { data, error } = await supabase
    .from("materials")
    .insert({
      subject_id: subjectId,
      ...topicFields(choice.data),
      kind: "web",
      title: webPlaceholderTitle(sourceUrl),
      source_url: sourceUrl,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "No se pudo agregar el enlace. Inténtalo de nuevo." };

  refresh();
  return { ok: true, data: { id: data.id } };
}

export type YoutubePreview = {
  videoId: string;
  title: string | null;
  durationSeconds: number | null;
  maxSeconds: number;
  costPerMinuteUsd: number;
  remainingBudgetUsd: number;
};

// Before transcribing: title, duration and estimated cost of the video.
export async function previewYoutube(rawUrl: string): Promise<ActionResult<YoutubePreview>> {
  await requireUser();
  const videoId = parseYoutubeId(rawUrl);
  if (!videoId) return { ok: false, error: "No es un enlace de YouTube válido." };

  let info;
  try {
    info = await fetchYoutubeInfo(videoId);
  } catch {
    return { ok: false, error: "El video no es público o no existe." };
  }

  try {
    const model = getModel("fast");
    const budget = await getBudgetStatus();
    return {
      ok: true,
      data: {
        videoId,
        title: info.title,
        durationSeconds: info.durationSeconds,
        maxSeconds: MAX_VIDEO_SECONDS,
        costPerMinuteUsd: estimateVideoCostUsd(model, 60),
        remainingBudgetUsd: Math.max(0, budget.budgetUsd - budget.spentUsd),
      },
    };
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.userMessage };
    console.error("[materials] youtube preview failed:", error);
    return { ok: false, error: "No se pudo calcular el costo. Inténtalo de nuevo." };
  }
}

const youtubeInputSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().trim().max(300).nullable(),
  durationSeconds: z.number().int().min(1).max(MAX_VIDEO_SECONDS),
  topic: topicChoiceSchema,
});

export async function addYoutubeMaterial(
  subjectId: string,
  input: z.input<typeof youtubeInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) return { ok: false, error: "Materia no válida." };
  const parsed = youtubeInputSchema.safeParse(input);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((issue) => issue.path[0] === "durationSeconds");
    return {
      ok: false,
      error: tooLong ? `El video puede durar hasta ${MAX_VIDEO_SECONDS / 60} minutos.` : "Datos del video no válidos.",
    };
  }
  const { videoId, title, durationSeconds, topic } = parsed.data;

  if (!(await subjectExists(supabase, subjectId))) return { ok: false, error: "No encontramos esta materia." };
  if (!(await checkTopic(supabase, subjectId, topic))) return { ok: false, error: "Ese tema ya no existe. Elige otro." };
  const sourceUrl = youtubeWatchUrl(videoId);
  if (await isDuplicateLink(supabase, subjectId, sourceUrl)) {
    return { ok: false, error: "Ese video ya está en el material de esta materia." };
  }

  try {
    const cost = estimateVideoCostUsd(getModel("fast"), durationSeconds);
    const budget = await getBudgetStatus();
    const remaining = budget.budgetUsd - budget.spentUsd;
    if (cost > remaining) {
      return {
        ok: false,
        error: `Transcribir este video costaría unos ${cost.toFixed(2)} USD y quedan ${Math.max(0, remaining).toFixed(2)} USD del presupuesto del mes.`,
      };
    }
  } catch (error) {
    if (error instanceof AiError) return { ok: false, error: error.userMessage };
    return { ok: false, error: "No se pudo revisar el presupuesto de IA. Inténtalo de nuevo." };
  }

  const { data, error } = await supabase
    .from("materials")
    .insert({
      subject_id: subjectId,
      ...topicFields(topic),
      kind: "youtube",
      title: title || "Video de YouTube",
      source_url: sourceUrl,
      duration_seconds: durationSeconds,
      total_units: Math.ceil(durationSeconds / VIDEO_SEGMENT_SECONDS),
      status: "queued",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "No se pudo agregar el video. Inténtalo de nuevo." };

  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function setMaterialTopic(
  materialId: string,
  topic: "general" | (string & {}),
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const choice = z.union([z.literal("general"), z.uuid()]).safeParse(topic);
  if (!idSchema.safeParse(materialId).success || !choice.success) return { ok: false, error: "Tema no válido." };

  const { error } = await supabase.from("materials").update(topicFields(choice.data)).eq("id", materialId);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("topic_not_in_subject")
        ? "Ese tema es de otra materia."
        : "No se pudo cambiar el tema.",
    };
  }
  refresh();
  return { ok: true };
}

export async function renameMaterial(materialId: string, title: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const value = title.trim();
  if (!idSchema.safeParse(materialId).success) return { ok: false, error: "Material no válido." };
  if (!value || value.length > 300) return { ok: false, error: "Escribe un nombre de hasta 300 caracteres." };

  const { error } = await supabase.from("materials").update({ title: value }).eq("id", materialId);
  if (error) return { ok: false, error: "No se pudo cambiar el nombre." };
  refresh();
  return { ok: true };
}

export async function deleteMaterial(materialId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(materialId).success) return { ok: false, error: "Material no válido." };

  if (!(await removeMaterialFiles(supabase, { materialIds: [materialId] }))) {
    return { ok: false, error: "No se pudieron borrar los archivos. Inténtalo de nuevo." };
  }
  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) return { ok: false, error: "No se pudo borrar el material." };
  refresh();
  return { ok: true };
}

// Continues from where it stopped: fragments already saved are kept.
export async function retryMaterial(materialId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(materialId).success) return { ok: false, error: "Material no válido." };

  const { error } = await supabase
    .from("materials")
    .update({ status: "queued", error: null, locked_until: null })
    .eq("id", materialId)
    .eq("status", "failed");
  if (error) return { ok: false, error: "No se pudo reintentar." };
  refresh();
  return { ok: true };
}
