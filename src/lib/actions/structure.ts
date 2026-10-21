"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { titleSchema } from "@/lib/validation";

import type { ActionResult } from "./types";

// Units and topics of a subject. Every action re-checks the session and relies
// on RLS, so ids coming from the browser can only reach the user's own rows.

const idSchema = z.uuid();
const idListSchema = z.array(z.uuid()).max(500);

function invalid(error = "Datos no válidos."): ActionResult<never> {
  return { ok: false, error };
}

export async function createUnit(subjectId: string, title: string): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  const parsedTitle = titleSchema(200).safeParse(title);
  if (!idSchema.safeParse(subjectId).success) return invalid();
  if (!parsedTitle.success) return invalid(parsedTitle.error.issues[0].message);

  const { data: last } = await supabase
    .from("units")
    .select("position")
    .eq("subject_id", subjectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("units")
    .insert({ subject_id: subjectId, title: parsedTitle.data, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return invalid("No se pudo agregar la unidad.");

  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function renameUnit(unitId: string, title: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsedTitle = titleSchema(200).safeParse(title);
  if (!idSchema.safeParse(unitId).success) return invalid();
  if (!parsedTitle.success) return invalid(parsedTitle.error.issues[0].message);

  const { error } = await supabase.from("units").update({ title: parsedTitle.data }).eq("id", unitId);
  if (error) return invalid("No se pudo renombrar la unidad.");

  refresh();
  return { ok: true };
}

export async function deleteUnit(unitId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(unitId).success) return invalid();

  const { error } = await supabase.from("units").delete().eq("id", unitId);
  if (error) return invalid("No se pudo borrar la unidad.");

  refresh();
  return { ok: true };
}

export async function reorderUnits(subjectId: string, unitIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(subjectId).success || !idListSchema.safeParse(unitIds).success) return invalid();

  const { error } = await supabase.rpc("reorder_units", { p_subject_id: subjectId, p_unit_ids: unitIds });
  if (error) return invalid("No se pudo cambiar el orden. Recarga la página.");

  refresh();
  return { ok: true };
}

export async function createTopic(unitId: string, title: string): Promise<ActionResult<{ id: string }>> {
  const { supabase } = await requireUser();
  const parsedTitle = titleSchema(300).safeParse(title);
  if (!idSchema.safeParse(unitId).success) return invalid();
  if (!parsedTitle.success) return invalid(parsedTitle.error.issues[0].message);

  const { data: last } = await supabase
    .from("topics")
    .select("position")
    .eq("unit_id", unitId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("topics")
    .insert({ unit_id: unitId, title: parsedTitle.data, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return invalid("No se pudo agregar el tema.");

  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function renameTopic(topicId: string, title: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const parsedTitle = titleSchema(300).safeParse(title);
  if (!idSchema.safeParse(topicId).success) return invalid();
  if (!parsedTitle.success) return invalid(parsedTitle.error.issues[0].message);

  const { error } = await supabase.from("topics").update({ title: parsedTitle.data }).eq("id", topicId);
  if (error) return invalid("No se pudo renombrar el tema.");

  refresh();
  return { ok: true };
}

export async function deleteTopic(topicId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(topicId).success) return invalid();

  const { error } = await supabase.from("topics").delete().eq("id", topicId);
  if (error) return invalid("No se pudo borrar el tema.");

  refresh();
  return { ok: true };
}

// New order of a unit's topics; may include a topic moved from another unit.
export async function reorderTopics(unitId: string, topicIds: string[]): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(unitId).success || !idListSchema.safeParse(topicIds).success) return invalid();

  const { error } = await supabase.rpc("reorder_topics", { p_unit_id: unitId, p_topic_ids: topicIds });
  if (error) return invalid("No se pudo mover el tema. Recarga la página.");

  refresh();
  return { ok: true };
}
