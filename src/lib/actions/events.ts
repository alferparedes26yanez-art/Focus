"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import type { ServerSupabase } from "@/lib/supabase/server";
import { eventInputSchema, type EventInput } from "@/lib/validation";

import { fieldErrorsFrom, type ActionResult } from "./types";

const idSchema = z.uuid();

// Keeps only units that belong to the event's subject.
async function linkUnits(supabase: ServerSupabase, eventId: string, subjectId: string, unitIds: string[]) {
  if (unitIds.length === 0) return null;
  const { data: units, error } = await supabase
    .from("units")
    .select("id")
    .eq("subject_id", subjectId)
    .in("id", unitIds);
  if (error) return error;
  if (units.length === 0) return null;

  const { error: insertError } = await supabase
    .from("event_units")
    .insert(units.map((unit) => ({ event_id: eventId, unit_id: unit.id })));
  return insertError;
}

export async function createEvent(subjectId: string, input: EventInput): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = eventInputSchema.safeParse(input);
  if (!idSchema.safeParse(subjectId).success || !parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos de la evaluación.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error.issues),
    };
  }

  const { unit_ids: unitIds, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from("events")
    .insert({ ...fields, subject_id: subjectId })
    .select("id")
    .single();
  if (error) return { ok: false, error: "No se pudo guardar la evaluación." };

  const linkError = await linkUnits(supabase, data.id, subjectId, unitIds);
  if (linkError) return { ok: false, error: "Se guardó la evaluación, pero no las unidades que entran." };

  refresh();
  return { ok: true };
}

export async function updateEvent(eventId: string, input: EventInput): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsed = eventInputSchema.safeParse(input);
  if (!idSchema.safeParse(eventId).success || !parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos de la evaluación.",
      fieldErrors: parsed.success ? undefined : fieldErrorsFrom(parsed.error.issues),
    };
  }

  const { unit_ids: unitIds, ...fields } = parsed.data;
  const { data, error } = await supabase
    .from("events")
    .update(fields)
    .eq("id", eventId)
    .select("subject_id")
    .single();
  if (error) return { ok: false, error: "No se pudieron guardar los cambios." };

  const { error: unlinkError } = await supabase.from("event_units").delete().eq("event_id", eventId);
  const linkError = unlinkError ?? (await linkUnits(supabase, eventId, data.subject_id, unitIds));
  if (linkError) return { ok: false, error: "No se pudieron guardar las unidades que entran." };

  refresh();
  return { ok: true };
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(eventId).success) return { ok: false, error: "Evaluación no válida." };

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { ok: false, error: "No se pudo borrar la evaluación." };

  refresh();
  return { ok: true };
}
