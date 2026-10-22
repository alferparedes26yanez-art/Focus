import "server-only";

import { MediaResolution, type Part } from "@google/genai";

import { embedTexts, generateJson } from "@/lib/ai/client";
import { AiError } from "@/lib/ai/errors";
import { pagesTranscriptionPrompt, videoTranscriptPrompt } from "@/lib/ai/prompts";
import type { ServerSupabase } from "@/lib/supabase/server";
import { storedFileSchema, type StoredFile } from "@/lib/syllabus/prepare-files";

import { chunkUnits, type ChunkDraft, type SourceUnit } from "./chunk";
import { classifyMaterial } from "./classify";
import { readDocxSections } from "./extract/docx";
import { MIN_PAGE_TEXT, pdfWithPages, readPdfPages } from "./extract/pdf";
import { readPptxSlides } from "./extract/pptx";
import { readWebPage, WebPageError, webPlaceholderTitle } from "./extract/web";
import { toVideoSeconds, VIDEO_SEGMENT_SECONDS } from "./extract/youtube";
import { pagesTranscriptSchema, videoTranscriptSchema } from "./schemas";

// Material is read in batches, one per request, so every request fits in the
// serverless time limit. The browser keeps calling until the material is
// ready. Each batch extracts text (or transcribes it with Gemini), splits it
// into fragments, embeds them and saves them with the progress atomically.

// Longer than the function's maxDuration, so a crashed run frees it.
const LOCK_MS = 70_000;
const PDF_PAGES_PER_BATCH = 30;
const OCR_PAGES_PER_BATCH = 5;
const MAX_PDF_PAGES = 1000;
const SLIDES_PER_BATCH = 40;
const PHOTOS_PER_BATCH = 4;
const CHUNKS_PER_BATCH = 60;
const MAX_WEB_CHUNKS = 120;
// Gemini accepts up to 20 MB of inline data per request.
const MAX_INLINE_BYTES = 18 * 1024 * 1024;
// Time an OCR or video call needs; otherwise the batch waits for a new request.
const MIN_AI_READ_MS = 25_000;
const MIN_CLASSIFY_MS = 10_000;

const MATERIAL_COLUMNS =
  "id, subject_id, kind, title, is_syllabus, storage_bucket, files, source_url, processed_units, total_units, duration_seconds, topic_source";

type MaterialRow = {
  id: string;
  subject_id: string;
  kind: string;
  title: string;
  is_syllabus: boolean;
  storage_bucket: string;
  files: unknown;
  source_url: string | null;
  processed_units: number;
  total_units: number | null;
  duration_seconds: number | null;
  topic_source: string;
};

// A problem with the material itself; the message is shown to the student.
class MaterialError extends Error {}

class OutOfTimeError extends Error {}

type Batch = {
  drafts: ChunkDraft[];
  toUnits: number;
  totalUnits: number;
  title?: string | null;
};

type BatchContext = {
  supabase: ServerSupabase;
  userId: string;
  material: MaterialRow;
  deadline: number;
};

export type ProcessOutcome =
  | { ok: true; status: "processing" | "ready"; processed: number; total: number | null; waiting?: boolean }
  | { ok: false; status: number; error: string; retryable: boolean };

function ensureTimeForAi(deadline: number) {
  if (deadline - Date.now() < MIN_AI_READ_MS) throw new OutOfTimeError();
}

function materialFiles(material: MaterialRow): StoredFile[] {
  const files = storedFileSchema.array().safeParse(material.files);
  if (!files.success || files.data.length === 0) {
    throw new MaterialError("No encontramos el archivo de este material. Súbelo de nuevo.");
  }
  return files.data;
}

async function download(context: BatchContext, file: StoredFile): Promise<Buffer> {
  const { data, error } = await context.supabase.storage.from(context.material.storage_bucket).download(file.path);
  if (error || !data) {
    console.error("[materials] download failed:", error?.message);
    throw new MaterialError("No pudimos abrir el archivo subido. Bórralo y súbelo de nuevo.");
  }
  return Buffer.from(await data.arrayBuffer());
}

// Sends pages or photos to Gemini and returns their text in the same order.
async function transcribe(
  context: BatchContext,
  parts: Part[],
  count: number,
  source: "pdf" | "photos",
): Promise<string[]> {
  const prompt = pagesTranscriptionPrompt({ count, source });
  const output = await generateJson({
    feature: "material_reading",
    tier: "fast",
    userId: context.userId,
    schema: pagesTranscriptSchema,
    systemInstruction: prompt.systemInstruction,
    parts: [...parts, { text: prompt.instruction }],
    maxOutputTokens: 4_096 * count,
    deadline: context.deadline,
  });
  const texts = Array.from({ length: count }, () => "");
  for (const page of output.pages) {
    if (page.page <= count) texts[page.page - 1] = page.text.trim();
  }
  return texts;
}

async function readPdfBatch(context: BatchContext, from: number): Promise<Batch> {
  const buffer = await download(context, materialFiles(context.material)[0]);
  let result;
  try {
    result = await readPdfPages(buffer, from + 1, from + PDF_PAGES_PER_BATCH);
  } catch (error) {
    console.error("[materials] pdf read failed:", error);
    const locked = error instanceof Error && /password/i.test(`${error.name} ${error.message}`);
    throw new MaterialError(
      locked
        ? "El PDF está protegido con contraseña. Quítasela y súbelo de nuevo."
        : "No pudimos abrir este PDF. Revisa que no esté dañado.",
    );
  }
  const { totalPages, pages } = result;
  if (totalPages === 0) throw new MaterialError("El PDF no tiene páginas.");
  if (totalPages > MAX_PDF_PAGES) {
    throw new MaterialError(`El PDF tiene ${totalPages} páginas y el máximo es ${MAX_PDF_PAGES}. Divídelo en partes.`);
  }

  // Pages with almost no text (scans, image slides) are transcribed by Gemini;
  // a batch stops after a few of them so the call fits in the time limit.
  let batch = pages;
  const scanned: number[] = [];
  for (const [index, page] of pages.entries()) {
    if (page.text.length >= MIN_PAGE_TEXT) continue;
    scanned.push(page.page);
    if (scanned.length === OCR_PAGES_PER_BATCH) {
      batch = pages.slice(0, index + 1);
      break;
    }
  }

  const transcribed = new Map<number, string>();
  if (scanned.length > 0) {
    ensureTimeForAi(context.deadline);
    const subset = await pdfWithPages(buffer, scanned).catch(() => null);
    if (subset && subset.length <= MAX_INLINE_BYTES) {
      const texts = await transcribe(
        context,
        [{ inlineData: { mimeType: "application/pdf", data: subset.toString("base64") } }],
        scanned.length,
        "pdf",
      );
      scanned.forEach((page, index) => transcribed.set(page, texts[index]));
    }
  }

  const units: SourceUnit[] = batch.map((page) => {
    const ocr = transcribed.get(page.page) ?? "";
    return { page: page.page, text: ocr.length > page.text.length ? ocr : page.text };
  });
  return {
    drafts: chunkUnits(units),
    toUnits: batch.at(-1)?.page ?? totalPages,
    totalUnits: totalPages,
  };
}

async function readPhotosBatch(context: BatchContext, from: number): Promise<Batch> {
  const files = materialFiles(context.material);
  const selected: StoredFile[] = [];
  let bytes = 0;
  for (const file of files.slice(from, from + PHOTOS_PER_BATCH)) {
    if (file.size > MAX_INLINE_BYTES) {
      throw new MaterialError(`La foto «${file.name}» pesa demasiado para leerla (máximo 18 MB).`);
    }
    if (selected.length > 0 && bytes + file.size > MAX_INLINE_BYTES) break;
    selected.push(file);
    bytes += file.size;
  }
  if (selected.length === 0) return { drafts: [], toUnits: files.length, totalUnits: files.length };

  ensureTimeForAi(context.deadline);
  const parts: Part[] = [];
  for (const file of selected) {
    const buffer = await download(context, file);
    parts.push({ inlineData: { mimeType: file.mime_type, data: buffer.toString("base64") } });
  }
  const texts = await transcribe(context, parts, selected.length, "photos");
  const units = texts.map((text, index) => ({ page: from + index + 1, text }));
  return { drafts: chunkUnits(units), toUnits: from + selected.length, totalUnits: files.length };
}

async function readSlidesBatch(context: BatchContext, from: number): Promise<Batch> {
  const buffer = await download(context, materialFiles(context.material)[0]);
  let slides;
  try {
    slides = await readPptxSlides(buffer);
  } catch (error) {
    console.error("[materials] pptx read failed:", error);
    throw new MaterialError("No pudimos abrir esta presentación. Revisa que sea un archivo .pptx válido.");
  }
  if (slides.length === 0) throw new MaterialError("La presentación no tiene diapositivas.");
  const batch = slides.slice(from, from + SLIDES_PER_BATCH);
  return {
    drafts: chunkUnits(batch.map((slide) => ({ page: slide.slide, text: slide.text }))),
    toUnits: from + batch.length,
    totalUnits: slides.length,
  };
}

// Word and web pages are split once and indexed by fragments.
function sliceDrafts(drafts: ChunkDraft[], from: number, size: number): Batch {
  const batch = drafts.slice(from, from + size);
  return { drafts: batch, toUnits: from + batch.length, totalUnits: drafts.length };
}

async function readDocxBatch(context: BatchContext, from: number): Promise<Batch> {
  const buffer = await download(context, materialFiles(context.material)[0]);
  let sections;
  try {
    sections = await readDocxSections(buffer);
  } catch (error) {
    console.error("[materials] docx read failed:", error);
    throw new MaterialError("No pudimos abrir este documento de Word. Revisa que sea un .docx válido.");
  }
  return sliceDrafts(chunkUnits(sections), from, CHUNKS_PER_BATCH);
}

async function readWebBatch(context: BatchContext, from: number): Promise<Batch> {
  if (!context.material.source_url) throw new MaterialError("Este enlace no es válido.");
  let page;
  try {
    page = await readWebPage(context.material.source_url);
  } catch (error) {
    if (error instanceof WebPageError) throw new MaterialError(error.message);
    console.error("[materials] web read failed:", error);
    throw new MaterialError("No pudimos leer esa página web.");
  }
  // A page is read in one go (it could change between requests).
  const drafts = chunkUnits(page.sections).slice(0, MAX_WEB_CHUNKS);
  return { ...sliceDrafts(drafts, from, MAX_WEB_CHUNKS), title: page.title };
}

async function readVideoBatch(context: BatchContext, from: number): Promise<Batch> {
  const { source_url: url, duration_seconds: duration } = context.material;
  if (!url || !duration) throw new MaterialError("Falta la duración de este video. Bórralo y agrégalo de nuevo.");
  const totalUnits = Math.ceil(duration / VIDEO_SEGMENT_SECONDS);
  if (from >= totalUnits) return { drafts: [], toUnits: totalUnits, totalUnits };

  ensureTimeForAi(context.deadline);
  const start = from * VIDEO_SEGMENT_SECONDS;
  const end = Math.min(start + VIDEO_SEGMENT_SECONDS, duration);
  const prompt = videoTranscriptPrompt({ clipSeconds: end - start });

  let output;
  try {
    output = await generateJson({
      feature: "material_reading",
      tier: "fast",
      userId: context.userId,
      schema: videoTranscriptSchema,
      systemInstruction: prompt.systemInstruction,
      parts: [
        {
          fileData: { fileUri: url },
          videoMetadata: { startOffset: `${start}s`, endOffset: `${end}s`, fps: 0.5 },
        },
        { text: prompt.instruction },
      ],
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      maxOutputTokens: 8_192,
      deadline: context.deadline,
    });
  } catch (error) {
    if (error instanceof AiError && error.code === "request_failed") {
      throw new MaterialError(
        "No pudimos ver este video. Revisa que sea público en YouTube y que no tenga restricción de edad.",
      );
    }
    throw error;
  }

  const segments = output.segments.filter((segment) => segment.text.trim());
  const seconds = toVideoSeconds(
    segments.map((segment) => segment.start_seconds),
    start,
    end - start,
  );
  const units = segments
    .map((segment, index) => ({ startSeconds: seconds[index], text: segment.text }))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  return { drafts: chunkUnits(units), toUnits: from + 1, totalUnits };
}

function readBatch(context: BatchContext, from: number): Promise<Batch> {
  switch (context.material.kind) {
    case "pdf":
      return readPdfBatch(context, from);
    case "images":
      return readPhotosBatch(context, from);
    case "pptx":
      return readSlidesBatch(context, from);
    case "docx":
      return readDocxBatch(context, from);
    case "web":
      return readWebBatch(context, from);
    case "youtube":
      return readVideoBatch(context, from);
    default:
      throw new MaterialError("Este tipo de material no se puede leer.");
  }
}

const EMPTY_MESSAGES: Record<string, string> = {
  pdf: "No encontramos texto en este PDF.",
  images: "No encontramos texto legible en las fotos. Prueba con fotos más nítidas.",
  pptx: "La presentación no tiene texto que podamos leer. Expórtala a PDF desde PowerPoint y súbela de nuevo.",
  docx: "El documento no tiene texto que podamos leer.",
  web: "No encontramos texto en esa página.",
  youtube: "No encontramos voz ni texto en este video.",
};

// The title (and section) go into the embedding so a fragment is found by
// what the whole document is about, not only by its own words.
function embeddingText(title: string, draft: ChunkDraft): string {
  return `${title}${draft.section ? ` — ${draft.section}` : ""}\n\n${draft.content}`;
}

export async function processMaterialBatch(input: {
  supabase: ServerSupabase;
  userId: string;
  materialId: string;
  deadline: number;
}): Promise<ProcessOutcome> {
  const { supabase, userId, materialId, deadline } = input;

  // Claim the material so two tabs never process (and pay for) the same batch.
  const now = new Date();
  const { data: claimed, error: claimError } = await supabase
    .from("materials")
    .update({ status: "processing", locked_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq("id", materialId)
    .in("status", ["queued", "processing"])
    .or(`locked_until.is.null,locked_until.lt."${now.toISOString()}"`)
    .select(MATERIAL_COLUMNS)
    .maybeSingle();

  if (claimError) {
    console.error("[materials] claim failed:", claimError.message);
    return { ok: false, status: 500, error: "No se pudo iniciar la lectura del material.", retryable: true };
  }

  if (!claimed) {
    const { data: current } = await supabase
      .from("materials")
      .select("status, error, processed_units, total_units")
      .eq("id", materialId)
      .maybeSingle();
    if (!current) return { ok: false, status: 404, error: "No encontramos este material.", retryable: false };
    if (current.status === "ready") {
      return { ok: true, status: "ready", processed: current.processed_units, total: current.total_units };
    }
    if (current.status === "failed") {
      return {
        ok: false,
        status: 422,
        error: current.error ?? "No pudimos procesar este material.",
        retryable: false,
      };
    }
    if (current.status === "uploading") {
      return { ok: false, status: 409, error: "El archivo todavía se está subiendo.", retryable: false };
    }
    // Another request is working on it.
    return {
      ok: true,
      status: "processing",
      processed: current.processed_units,
      total: current.total_units,
      waiting: true,
    };
  }

  const material = claimed as MaterialRow;
  const from = material.processed_units;

  const release = () => supabase.from("materials").update({ locked_until: null }).eq("id", materialId);
  const fail = async (status: number, message: string): Promise<ProcessOutcome> => {
    await supabase
      .from("materials")
      .update({ status: "failed", error: message.slice(0, 500), locked_until: null })
      .eq("id", materialId);
    return { ok: false, status, error: message, retryable: false };
  };

  try {
    const batch = await readBatch({ supabase, userId, material, deadline }, from);
    const done = batch.toUnits >= batch.totalUnits;

    if (done && batch.drafts.length === 0) {
      const { count } = await supabase
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("material_id", materialId);
      if (!count) throw new MaterialError(EMPTY_MESSAGES[material.kind] ?? "No encontramos texto en este material.");
    }

    let title = material.title;
    if (batch.title && material.source_url && title === webPlaceholderTitle(material.source_url)) {
      title = batch.title.slice(0, 300);
      await supabase.from("materials").update({ title }).eq("id", materialId);
    }

    const vectors = await embedTexts({
      feature: "material_indexing",
      userId,
      texts: batch.drafts.map((draft) => embeddingText(title, draft)),
      purpose: "document",
      deadline,
    });

    const { error: saveError } = await supabase.rpc("save_material_batch", {
      p_material_id: materialId,
      p_from_units: from,
      p_to_units: batch.toUnits,
      p_total_units: batch.totalUnits,
      p_chunks: batch.drafts.map((draft, index) => ({ ...draft, embedding: JSON.stringify(vectors[index]) })),
      p_done: done,
    });
    if (saveError) {
      if (saveError.message.includes("batch_conflict")) {
        // Another run saved this batch first (or the material was retried).
        return { ok: true, status: "processing", processed: from, total: batch.totalUnits, waiting: true };
      }
      throw new Error(saveError.message);
    }

    // File the material under a syllabus topic as soon as there is some text.
    const excerpt = batch.drafts.map((draft) => draft.content).join("\n\n");
    if (material.topic_source === "pending" && !material.is_syllabus && excerpt && deadline - Date.now() > MIN_CLASSIFY_MS) {
      await classifyMaterial({ supabase, userId, material: { ...material, title }, excerpt, deadline }).catch(
        (error) => console.warn("[materials] topic suggestion failed:", error instanceof Error ? error.message : error),
      );
    }

    return { ok: true, status: done ? "ready" : "processing", processed: batch.toUnits, total: batch.totalUnits };
  } catch (error) {
    if (error instanceof OutOfTimeError) {
      await release();
      return { ok: true, status: "processing", processed: from, total: material.total_units };
    }
    if (error instanceof MaterialError) return fail(422, error.message);
    if (error instanceof AiError) {
      if (error.code === "busy") {
        await release();
        return { ok: false, status: 503, error: error.userMessage, retryable: true };
      }
      return fail(error.code === "budget_exceeded" ? 402 : 502, error.userMessage);
    }
    console.error("[materials] processing failed:", error);
    return fail(500, "No pudimos procesar este material. Inténtalo de nuevo.");
  }
}
