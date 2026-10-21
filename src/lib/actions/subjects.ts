"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { removeSyllabusFiles } from "@/lib/syllabus/storage";
import { subjectInputSchema, type SubjectInput } from "@/lib/validation";

import { fieldErrorsFrom, type ActionResult } from "./types";

const idSchema = z.uuid();

export async function createSubject(input: SubjectInput): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  const parsed = subjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos de la materia.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const { data, error } = await supabase.from("subjects").insert(parsed.data).select("id").single();
  if (error) {
    return { ok: false, error: "No se pudo crear la materia. Inténtalo de nuevo." };
  }

  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function updateSubject(subjectId: string, input: SubjectInput): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = subjectInputSchema.safeParse(input);
  if (!idSchema.safeParse(subjectId).success || !parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos de la materia.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error.issues),
    };
  }

  const { error } = await supabase.from("subjects").update(parsed.data).eq("id", subjectId);
  if (error) {
    return { ok: false, error: "No se pudieron guardar los cambios." };
  }

  refresh();
  return { ok: true };
}

export async function deleteSubject(subjectId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) {
    return { ok: false, error: "Materia no válida." };
  }

  if (!(await removeSyllabusFiles(supabase, { subjectId }))) {
    return { ok: false, error: "No se pudieron borrar los archivos del sílabo. Inténtalo de nuevo." };
  }

  const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (error) {
    return { ok: false, error: "No se pudo borrar la materia." };
  }

  return { ok: true };
}

// "Vaciar materia": deletes units, topics, evaluations, course info and the
// syllabus files so a new syllabus can be loaded.
export async function clearSubject(subjectId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(subjectId).success) {
    return { ok: false, error: "Materia no válida." };
  }

  if (!(await removeSyllabusFiles(supabase, { subjectId }))) {
    return { ok: false, error: "No se pudieron borrar los archivos del sílabo. Inténtalo de nuevo." };
  }

  const { error } = await supabase.rpc("clear_subject", { p_subject_id: subjectId });
  if (error) {
    return { ok: false, error: "No se pudo vaciar la materia." };
  }

  refresh();
  return { ok: true };
}
