import "server-only";

import { generateJson } from "@/lib/ai/client";
import { AiError } from "@/lib/ai/errors";
import { syllabusExtractionPrompt } from "@/lib/ai/prompts";
import { DEFAULT_TIME_ZONE, todayIn } from "@/lib/dates";
import type { ServerSupabase } from "@/lib/supabase/server";

import { isImageMime } from "./files";
import { normalizeSyllabusOutput } from "./normalize";
import { buildSyllabusParts, storedFileSchema } from "./prepare-files";
import { syllabusAiOutputSchema } from "./schemas";

// A run that died with the serverless function (timeout) stays "processing";
// after this long it may be retried.
const STALE_PROCESSING_MS = 90_000;

export type ExtractionResult =
  | { ok: true; status: "review" }
  | { ok: false; status: number; error: string };

export async function runSyllabusExtraction(input: {
  supabase: ServerSupabase;
  userId: string;
  importId: string;
  deadline: number;
}): Promise<ExtractionResult> {
  const { supabase, userId, importId, deadline } = input;

  // Claim the import atomically so a double click cannot pay for two runs:
  // first if it is waiting, then if a previous run died. Two plain filters
  // instead of one or(...), which PostgREST also applies to the updated row.
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const claim = (from: "waiting" | "stale") => {
    const query = supabase
      .from("syllabus_imports")
      .update({ status: "processing", error: null })
      .eq("id", importId);
    return (
      from === "waiting"
        ? query.in("status", ["pending", "failed"])
        : query.eq("status", "processing").lt("updated_at", staleBefore)
    )
      .select("id, files")
      .maybeSingle();
  };
  let { data: claimed, error: claimError } = await claim("waiting");
  if (!claimError && !claimed) ({ data: claimed, error: claimError } = await claim("stale"));

  if (claimError) {
    return { ok: false, status: 500, error: "No se pudo iniciar la lectura del sílabo." };
  }

  if (!claimed) {
    const { data: current } = await supabase
      .from("syllabus_imports")
      .select("status")
      .eq("id", importId)
      .maybeSingle();
    if (!current) return { ok: false, status: 404, error: "No encontramos este sílabo." };
    if (current.status === "review") return { ok: true, status: "review" };
    if (current.status === "applied") {
      return { ok: false, status: 409, error: "Este sílabo ya se guardó en la materia." };
    }
    return { ok: false, status: 409, error: "Ya estamos leyendo este sílabo. Espera un momento." };
  }

  const fail = async (status: number, message: string) => {
    await supabase
      .from("syllabus_imports")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", importId);
    return { ok: false as const, status, error: message };
  };

  const files = storedFileSchema.array().min(1).safeParse(claimed.files);
  if (!files.success) {
    return fail(400, "No encontramos los archivos de este sílabo. Súbelo de nuevo.");
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .maybeSingle();
    const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
    const today = todayIn(timeZone);

    const parts = await buildSyllabusParts(supabase, files.data);
    const prompt = syllabusExtractionPrompt({
      today,
      timeZone,
      imageCount: files.data.filter((file) => isImageMime(file.mime_type)).length,
    });

    const output = await generateJson({
      feature: "syllabus_extraction",
      tier: "main",
      userId,
      schema: syllabusAiOutputSchema,
      systemInstruction: prompt.systemInstruction,
      parts: [...parts, { text: prompt.instruction }],
      maxOutputTokens: 16_384,
      deadline,
    });

    const { isSyllabus, notSyllabusReason, draft } = normalizeSyllabusOutput(output, { today });
    if (!isSyllabus) {
      const reason = notSyllabusReason ? ` ${notSyllabusReason.replace(/\.?$/, ".")}` : "";
      return fail(
        422,
        `El archivo no parece un sílabo.${reason} Sube el programa de la materia (con sus unidades, temas o fechas). Si es material de clase, agrégalo en la pestaña Material.`,
      );
    }

    const { error: saveError } = await supabase
      .from("syllabus_imports")
      .update({ status: "review", extraction: draft, error: null })
      .eq("id", importId);
    if (saveError) {
      return fail(500, "No se pudo guardar el resultado. Inténtalo de nuevo.");
    }

    return { ok: true, status: "review" };
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === "budget_exceeded" ? 402 : error.code === "busy" ? 503 : 502;
      return fail(status, error.userMessage);
    }
    console.error("[syllabus] extraction failed:", error);
    return fail(500, "No pudimos leer el sílabo. Inténtalo de nuevo.");
  }
}
