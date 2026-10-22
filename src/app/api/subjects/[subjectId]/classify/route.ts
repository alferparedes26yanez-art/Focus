import { NextResponse } from "next/server";
import { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import { getSession } from "@/lib/auth";
import { classifyMaterial, loadTopicOptions } from "@/lib/materials/classify";

// "Ordenar según el sílabo": files the material that is waiting for a topic.
// Works through as many as fit in the time limit; the browser calls again
// while some remain.
export const maxDuration = 60;

const TIME_BUDGET_MS = 50_000;
const MIN_CALL_MS = 10_000;
const EXCERPT_CHUNKS = 4;

export async function POST(_request: Request, context: RouteContext<"/api/subjects/[subjectId]/classify">) {
  const startedAt = Date.now();
  const deadline = startedAt + TIME_BUDGET_MS;
  const { subjectId } = await context.params;

  if (!z.uuid().safeParse(subjectId).success) {
    return NextResponse.json({ error: "Materia no válida." }, { status: 400 });
  }

  const { supabase, userId } = await getSession();
  if (!userId) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const topics = await loadTopicOptions(supabase, subjectId).catch(() => null);
  if (!topics) return NextResponse.json({ error: "No se pudieron leer los temas." }, { status: 500 });
  if (topics.length === 0) {
    return NextResponse.json(
      { error: "Esta materia todavía no tiene temas. Sube el sílabo o agrega los temas primero." },
      { status: 409 },
    );
  }

  // Only material with some text already indexed; the rest is classified
  // while it is read.
  const pendingQuery = () =>
    supabase
      .from("materials")
      .select("id, subject_id, title", { count: "exact" })
      .eq("subject_id", subjectId)
      .eq("topic_source", "pending")
      .eq("is_syllabus", false)
      .gt("processed_units", 0)
      .order("created_at", { ascending: true });

  const { data: pending, error } = await pendingQuery().limit(20);
  if (error) return NextResponse.json({ error: "No se pudo leer el material." }, { status: 500 });

  let classified = 0;
  for (const material of pending) {
    if (deadline - Date.now() < MIN_CALL_MS) break;
    const { data: chunks } = await supabase
      .from("chunks")
      .select("content")
      .eq("material_id", material.id)
      .order("position", { ascending: true })
      .limit(EXCERPT_CHUNKS);
    const excerpt = (chunks ?? []).map((chunk) => chunk.content).join("\n\n");
    try {
      if (await classifyMaterial({ supabase, userId, material, excerpt, deadline, topics })) classified++;
    } catch (classifyError) {
      if (classifyError instanceof AiError) {
        const status = classifyError.code === "budget_exceeded" ? 402 : classifyError.code === "busy" ? 503 : 502;
        return NextResponse.json({ error: classifyError.userMessage, classified }, { status });
      }
      console.error("[materials] classification failed:", classifyError);
      return NextResponse.json({ error: "No se pudo ordenar el material.", classified }, { status: 500 });
    }
  }

  const { count } = await pendingQuery().limit(1);
  return NextResponse.json({ classified, remaining: count ?? 0 });
}
