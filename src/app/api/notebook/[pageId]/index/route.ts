import { NextResponse } from "next/server";
import { z } from "zod";

import { AiError } from "@/lib/ai/errors";
import { getSession } from "@/lib/auth";
import { indexNotebookPage } from "@/lib/notebook/index-page";

// Called by the editor a few seconds after the student stops writing (and
// when leaving the page), so the chat can cite the notes.
export const maxDuration = 30;

const TIME_BUDGET_MS = 25_000;

export async function POST(_request: Request, context: RouteContext<"/api/notebook/[pageId]/index">) {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const { pageId } = await context.params;
  if (!z.uuid().safeParse(pageId).success) {
    return NextResponse.json({ error: "Página no válida." }, { status: 400 });
  }

  const { supabase, userId } = await getSession();
  if (!userId) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  try {
    const result = await indexNotebookPage({ supabase, userId, pageId, deadline });
    if (!result) return NextResponse.json({ error: "Esta página ya no existe." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === "budget_exceeded" ? 402 : error.code === "busy" ? 503 : 502;
      return NextResponse.json({ error: error.userMessage }, { status });
    }
    console.error("[notebook] indexing failed:", error);
    return NextResponse.json({ error: "No se pudo preparar la página para el chat." }, { status: 500 });
  }
}
