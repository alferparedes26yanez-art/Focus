import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { processMaterialBatch } from "@/lib/materials/process";

// Each request reads one batch of a material (pages, slides, photos or a video
// segment). 60 s fits every Vercel plan; the browser calls again until it is
// ready.
export const maxDuration = 60;

const TIME_BUDGET_MS = 50_000;

export async function POST(_request: Request, context: RouteContext<"/api/materials/[materialId]/process">) {
  const startedAt = Date.now();
  const { materialId } = await context.params;

  if (!z.uuid().safeParse(materialId).success) {
    return NextResponse.json({ error: "Material no válido." }, { status: 400 });
  }

  const { supabase, userId } = await getSession();
  if (!userId) {
    return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  }

  const result = await processMaterialBatch({
    supabase,
    userId,
    materialId,
    deadline: startedAt + TIME_BUDGET_MS,
  });

  if (result.ok) {
    return NextResponse.json({
      status: result.status,
      processed: result.processed,
      total: result.total,
      waiting: result.waiting ?? false,
    });
  }
  return NextResponse.json({ error: result.error, retryable: result.retryable }, { status: result.status });
}
