"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { safeFileName, validateSyllabusFiles, type SelectedFile } from "@/lib/syllabus/files";
import type { StoredFile } from "@/lib/syllabus/prepare-files";
import { syllabusApplySchema, type SyllabusApplyPayload } from "@/lib/syllabus/schemas";
import { removeSyllabusFiles } from "@/lib/syllabus/storage";

import type { ActionResult } from "./types";

const idSchema = z.uuid();

// Step 1 of a syllabus import: validate the files and reserve their Storage
// paths. The browser then uploads them directly to Storage (no size limit from
// the serverless function) and asks /api/syllabus/[id]/extract to read them.
export async function createSyllabusImport(
  subjectId: string,
  files: SelectedFile[],
): Promise<ActionResult<{ importId: string; uploads: { path: string; mimeType: string }[] }>> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) return { ok: false, error: "Materia no válida." };

  const selected = z
    .array(z.object({ name: z.string().max(255), size: z.number(), type: z.string().max(200) }))
    .max(20)
    .safeParse(files);
  if (!selected.success) return { ok: false, error: "Archivos no válidos." };
  const validation = validateSyllabusFiles(selected.data);
  if (!validation.ok) return { ok: false, error: validation.error };

  const [{ count: unitCount }, { count: eventCount }] = await Promise.all([
    supabase.from("units").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
  ]);
  if ((unitCount ?? 0) > 0 || (eventCount ?? 0) > 0) {
    return {
      ok: false,
      error: "Esta materia ya tiene contenido. Vacíala primero para cargar un sílabo nuevo.",
    };
  }

  // Unfinished earlier attempts are replaced by this one.
  const { data: previous } = await supabase
    .from("syllabus_imports")
    .select("id")
    .eq("subject_id", subjectId)
    .neq("status", "applied");
  if (previous && previous.length > 0) {
    const importIds = previous.map((row) => row.id);
    await removeSyllabusFiles(supabase, { importIds });
    await supabase.from("syllabus_imports").delete().in("id", importIds);
  }

  const importId = crypto.randomUUID();
  const stored: StoredFile[] = validation.files.map((file, index) => ({
    path: `${userId}/${subjectId}/${importId}/${index + 1}-${safeFileName(file.name, file.mimeType)}`,
    name: file.name.slice(0, 255),
    mime_type: file.mimeType,
    size: file.size,
  }));

  const { error } = await supabase.from("syllabus_imports").insert({
    id: importId,
    subject_id: subjectId,
    status: "pending",
    files: stored,
  });
  if (error) return { ok: false, error: "No se pudo preparar la subida. Inténtalo de nuevo." };

  return {
    ok: true,
    data: { importId, uploads: stored.map((file) => ({ path: file.path, mimeType: file.mime_type })) },
  };
}

const RPC_ERRORS: Record<string, string> = {
  subject_not_empty: "La materia ya tiene contenido. Vacíala primero para guardar este sílabo.",
  import_not_in_review: "Este sílabo ya se guardó o todavía no está listo.",
  import_not_found: "No encontramos este sílabo.",
};

export async function applySyllabusImport(
  importId: string,
  payload: SyllabusApplyPayload,
  options: { completeOnboarding?: boolean } = {},
): Promise<ActionResult<{ subjectId: string; units: number; topics: number; events: number }>> {
  const { supabase, userId } = await requireUser();
  if (!idSchema.safeParse(importId).success) return { ok: false, error: "Sílabo no válido." };

  const parsed = syllabusApplySchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Revisa el formulario: ${issue.message}.` };
  }
  const unitCount = parsed.data.units.length;
  if (parsed.data.events.some((event) => event.unit_indexes.some((index) => index >= unitCount))) {
    return { ok: false, error: "Una evaluación apunta a una unidad que ya no existe." };
  }

  const { data: importRow } = await supabase
    .from("syllabus_imports")
    .select("subject_id")
    .eq("id", importId)
    .maybeSingle();
  if (!importRow) return { ok: false, error: RPC_ERRORS.import_not_found };

  const { data, error } = await supabase.rpc("apply_syllabus_import", {
    p_import_id: importId,
    p_payload: parsed.data,
  });
  if (error) {
    const known = Object.keys(RPC_ERRORS).find((code) => error.message.includes(code));
    return { ok: false, error: known ? RPC_ERRORS[known] : "No se pudo guardar el sílabo. Inténtalo de nuevo." };
  }

  if (options.completeOnboarding) {
    await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", userId);
  }

  const counts = z.object({ units: z.number(), topics: z.number(), events: z.number() }).safeParse(data);
  refresh();
  return {
    ok: true,
    data: {
      subjectId: importRow.subject_id,
      ...(counts.success ? counts.data : { units: 0, topics: 0, events: 0 }),
    },
  };
}

export async function discardSyllabusImport(importId: string): Promise<ActionResult<{ subjectId: string }>> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(importId).success) return { ok: false, error: "Sílabo no válido." };

  const { data: importRow } = await supabase
    .from("syllabus_imports")
    .select("subject_id, status")
    .eq("id", importId)
    .maybeSingle();
  if (!importRow) return { ok: false, error: RPC_ERRORS.import_not_found };
  if (importRow.status === "applied") return { ok: false, error: RPC_ERRORS.import_not_in_review };

  await removeSyllabusFiles(supabase, { importIds: [importId] });
  const { error } = await supabase.from("syllabus_imports").delete().eq("id", importId);
  if (error) return { ok: false, error: "No se pudo descartar el sílabo." };

  refresh();
  return { ok: true, data: { subjectId: importRow.subject_id } };
}
