import "server-only";

import type { Part } from "@google/genai";
import mammoth from "mammoth";
import { z } from "zod";

import type { ServerSupabase } from "@/lib/supabase/server";

import { DOCX_MIME, SYLLABUS_BUCKET } from "./files";

export const storedFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  mime_type: z.string().min(1),
  size: z.number().int().positive(),
});

export type StoredFile = z.infer<typeof storedFileSchema>;

const MAX_DOCX_CHARS = 200_000;

async function download(supabase: ServerSupabase, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(SYLLABUS_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`No se pudo leer el archivo subido (${error?.message ?? "sin datos"}).`);
  }
  return Buffer.from(await data.arrayBuffer());
}

// Word files are not accepted by Gemini directly: convert them to HTML (keeps
// tables such as the grading breakdown) and drop embedded images.
async function docxToText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );
  return value.replace(/<img[^>]*>/g, "").slice(0, MAX_DOCX_CHARS);
}

// PDFs and photos go to Gemini as they are (it reads scanned pages and tables).
export async function buildSyllabusParts(
  supabase: ServerSupabase,
  files: StoredFile[],
): Promise<Part[]> {
  const parts: Part[] = [];
  for (const file of files) {
    const buffer = await download(supabase, file.path);
    if (file.mime_type === DOCX_MIME) {
      parts.push({ text: `Syllabus document converted from Word (HTML):\n\n${await docxToText(buffer)}` });
    } else {
      parts.push({ inlineData: { mimeType: file.mime_type, data: buffer.toString("base64") } });
    }
  }
  return parts;
}
