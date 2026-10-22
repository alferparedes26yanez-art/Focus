import { PDFDocument, StandardFonts } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { busyError } from "@/lib/ai/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

import { processMaterialBatch } from "./process";

const ai = vi.hoisted(() => ({
  embedTexts: vi.fn(async ({ texts }: { texts: string[] }) => texts.map(() => new Array(768).fill(0.1))),
  generateJson: vi.fn(),
}));
vi.mock("@/lib/ai/client", () => ai);

type Material = Record<string, unknown> & { id: string; processed_units: number; status: string };
type Chunk = { page: number | null; start_seconds: number | null; content: string };

// A tiny in-memory stand-in for the Supabase client: just the queries the
// processor makes.
function fakeSupabase(material: Material, files: Record<string, Buffer>, topics: { id: string; title: string }[] = []) {
  const chunks: Chunk[] = [];
  let locked = false;

  const query = (table: string) => {
    const state = { op: "select", payload: {} as Record<string, unknown>, filters: [] as [string, unknown][] };
    const run = () => {
      if (table === "materials" && state.op === "update") {
        const claiming = state.filters.some(([column]) => column === "status");
        const pendingOnly = state.filters.some(([column, value]) => column === "topic_source" && value === "pending");
        if (claiming) {
          if (locked || !["queued", "processing"].includes(material.status)) return { data: null, error: null };
          locked = true;
          Object.assign(material, state.payload);
          return { data: { ...material }, error: null };
        }
        if (pendingOnly && material.topic_source !== "pending") return { error: null };
        if ("locked_until" in state.payload) locked = false;
        Object.assign(material, state.payload);
        return { error: null };
      }
      if (table === "materials") return { data: { ...material }, error: null };
      if (table === "chunks") return { count: chunks.length, error: null };
      if (table === "units") {
        return {
          data: [{ title: "Unidad 1", position: 0, topics: topics.map((topic, position) => ({ ...topic, position })) }],
          error: null,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    };
    const chain = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => {
        state.op = "update";
        state.payload = payload;
        return chain;
      },
      eq: (column: string, value: unknown) => {
        state.filters.push([column, value]);
        return chain;
      },
      in: (column: string, value: unknown) => {
        state.filters.push([column, value]);
        return chain;
      },
      or: () => chain,
      maybeSingle: async () => run(),
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return chain;
  };

  const client = {
    from: query,
    storage: {
      from: () => ({
        download: async (path: string) =>
          files[path]
            ? { data: new Blob([new Uint8Array(files[path])]), error: null }
            : { data: null, error: { message: "not found" } },
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name !== "save_material_batch") throw new Error(name);
      if (args.p_from_units !== material.processed_units || material.status !== "processing") {
        return { error: { message: "batch_conflict" } };
      }
      for (const chunk of args.p_chunks as (Chunk & { embedding: string })[]) {
        expect(JSON.parse(chunk.embedding)).toHaveLength(768);
        chunks.push({ page: chunk.page, start_seconds: chunk.start_seconds, content: chunk.content });
      }
      Object.assign(material, {
        processed_units: args.p_to_units,
        total_units: args.p_total_units,
        status: args.p_done ? "ready" : "processing",
        locked_until: null,
      });
      locked = false;
      return { error: null };
    },
  };
  return { client: client as unknown as ServerSupabase, chunks, unlock: () => (locked = false) };
}

function newMaterial(extra: Partial<Material>): Material {
  return {
    id: "m1",
    subject_id: "s1",
    kind: "pdf",
    title: "Clase 1",
    is_syllabus: false,
    storage_bucket: "materials",
    files: [{ path: "u/s/m1/1-clase.pdf", name: "clase.pdf", mime_type: "application/pdf", size: 100 }],
    source_url: null,
    processed_units: 0,
    total_units: null,
    duration_seconds: null,
    topic_source: "general",
    status: "queued",
    ...extra,
  };
}

async function makePdf(pages: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage([600, 400]);
    text.split("\n").forEach((line, index) => page.drawText(line, { x: 20, y: 370 - index * 14, size: 9, font }));
  }
  return Buffer.from(await pdf.save());
}

const LONG = "La derivada de una funcion mide como cambia su valor cuando cambia la variable independiente.";
const run = (client: ServerSupabase) =>
  processMaterialBatch({ supabase: client, userId: "u1", materialId: "m1", deadline: Date.now() + 50_000 });

beforeEach(() => {
  ai.embedTexts.mockClear();
  ai.generateJson.mockReset();
});

describe("processMaterialBatch", () => {
  it("indexes a text PDF page by page and files it under the suggested topic", async () => {
    const material = newMaterial({ topic_source: "pending" });
    const pdf = await makePdf([`${LONG}\n${LONG}`, `${LONG} Segunda pagina.`, `${LONG} Tercera pagina.`]);
    const { client, chunks } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": pdf }, [
      { id: "t1", title: "Límites" },
      { id: "t2", title: "Derivadas" },
    ]);
    ai.generateJson.mockResolvedValueOnce({ topic_number: 2 });

    const result = await run(client);

    expect(result).toEqual({ ok: true, status: "ready", processed: 3, total: 3 });
    expect(chunks.map((chunk) => chunk.page)).toEqual([1, 2, 3]);
    expect(material).toMatchObject({ status: "ready", topic_id: "t2", topic_source: "ai" });
    expect(ai.embedTexts.mock.calls[0][0]).toMatchObject({ purpose: "document", feature: "material_indexing" });
    expect(ai.embedTexts.mock.calls[0][0].texts[0]).toMatch(/^Clase 1\n\n/);
  });

  it("reads long PDFs in several batches", async () => {
    const material = newMaterial({});
    const pdf = await makePdf(Array.from({ length: 33 }, (_, index) => `${LONG} Pagina ${index + 1}.`));
    const { client, chunks } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": pdf });

    expect(await run(client)).toMatchObject({ ok: true, status: "processing", processed: 30, total: 33 });
    expect(await run(client)).toMatchObject({ ok: true, status: "ready", processed: 33, total: 33 });
    expect(chunks).toHaveLength(33);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("sends pages without text to Gemini and uses their transcription", async () => {
    const material = newMaterial({});
    const pdf = await makePdf([LONG, "", LONG]);
    const { client, chunks } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": pdf });
    ai.generateJson.mockResolvedValueOnce({ pages: [{ page: 1, text: "Texto escrito a mano en la pagina dos." }] });

    expect(await run(client)).toMatchObject({ status: "ready", processed: 3 });
    expect(ai.generateJson.mock.calls[0][0]).toMatchObject({ feature: "material_reading", tier: "fast" });
    expect(chunks.find((chunk) => chunk.page === 2)?.content).toBe("Texto escrito a mano en la pagina dos.");
  });

  it("transcribes a YouTube video by segments with times from the start of the video", async () => {
    const material = newMaterial({
      kind: "youtube",
      files: [],
      source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      duration_seconds: 400,
    });
    const { client, chunks } = fakeSupabase(material, {});
    ai.generateJson
      .mockResolvedValueOnce({ has_speech: true, segments: [{ start_seconds: 5, text: "Hola, hoy vemos derivadas." }] })
      .mockResolvedValueOnce({ has_speech: true, segments: [{ start_seconds: 20, text: "La regla de la cadena." }] });

    expect(await run(client)).toMatchObject({ status: "processing", processed: 1, total: 2 });
    expect(await run(client)).toMatchObject({ status: "ready", processed: 2, total: 2 });
    expect(chunks.map((chunk) => chunk.start_seconds)).toEqual([5, 320]);
    const clip = ai.generateJson.mock.calls[1][0].parts[0];
    expect(clip).toMatchObject({
      fileData: { fileUri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      videoMetadata: { startOffset: "300s", endOffset: "400s" },
    });
  });

  it("lets only one request work on a material at a time", async () => {
    const material = newMaterial({});
    const { client } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": await makePdf([LONG]) });
    // First claim succeeds and keeps the lock while reading.
    const first = run(client);
    const second = await run(client);
    expect(second).toMatchObject({ ok: true, status: "processing", waiting: true });
    expect(await first).toMatchObject({ status: "ready" });
  });

  it("releases the material when the AI is busy so it can be retried", async () => {
    const material = newMaterial({});
    const { client } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": await makePdf([LONG]) });
    ai.embedTexts.mockRejectedValueOnce(busyError());

    expect(await run(client)).toMatchObject({ ok: false, status: 503, retryable: true });
    expect(material).toMatchObject({ status: "processing", locked_until: null, processed_units: 0 });
    expect(await run(client)).toMatchObject({ ok: true, status: "ready" });
  });

  it("marks the material as failed when it has no text", async () => {
    const material = newMaterial({});
    const { client } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": await makePdf([""]) });
    ai.generateJson.mockResolvedValueOnce({ pages: [{ page: 1, text: "" }] });

    const result = await run(client);
    expect(result).toMatchObject({ ok: false, retryable: false });
    expect(material).toMatchObject({ status: "failed", error: "No encontramos texto en este PDF." });
  });

  it("explains files that cannot be opened", async () => {
    const material = newMaterial({});
    const { client } = fakeSupabase(material, { "u/s/m1/1-clase.pdf": Buffer.from("esto no es un pdf") });

    expect(await run(client)).toMatchObject({ ok: false, status: 422 });
    expect(material.error).toMatch(/No pudimos abrir este PDF/);
  });
});
