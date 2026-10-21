import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { runSyllabusExtraction } from "@/lib/syllabus/extract";

// Reading a syllabus takes 10–40 s. 60 s fits every Vercel plan; the AI client
// stops retrying before this limit so the import is marked as failed cleanly.
export const maxDuration = 60;

const TIME_BUDGET_MS = 55_000;

export async function POST(_request: Request, context: RouteContext<"/api/syllabus/[importId]/extract">) {
  const startedAt = Date.now();
  const { importId } = await context.params;

  if (!z.uuid().safeParse(importId).success) {
    return NextResponse.json({ error: "Sílabo no válido." }, { status: 400 });
  }

  const { supabase, userId } = await getSession();
  if (!userId) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const result = await runSyllabusExtraction({
    supabase,
    userId,
    importId,
    deadline: startedAt + TIME_BUDGET_MS,
  });

  return result.ok
    ? NextResponse.json({ status: result.status })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
