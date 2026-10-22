import "server-only";

import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";

// Pages with less text than this are probably scanned or image slides and are
// sent to Gemini to be transcribed.
export const MIN_PAGE_TEXT = 80;

type TextItem = { str?: string; hasEOL?: boolean };

export async function readPdfPages(
  buffer: Buffer,
  fromPage: number,
  toPage: number,
): Promise<{ totalPages: number; pages: { page: number; text: string }[] }> {
  // pdf.js may take ownership of the bytes, so it gets its own copy.
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    const totalPages = pdf.numPages;
    const pages: { page: number; text: string }[] = [];
    for (let page = fromPage; page <= Math.min(toPage, totalPages); page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const text = (content.items as TextItem[])
        .map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : " "))
        .join("")
        .replace(/[ \t]+/g, " ")
        .trim();
      pages.push({ page, text });
    }
    return { totalPages, pages };
  } finally {
    await pdf.cleanup();
  }
}

// A smaller PDF with only some pages (1-based), to transcribe them with Gemini.
export async function pdfWithPages(buffer: Buffer, pages: number[]): Promise<Buffer> {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const output = await PDFDocument.create();
  const copied = await output.copyPages(
    source,
    pages.map((page) => page - 1),
  );
  for (const page of copied) output.addPage(page);
  return Buffer.from(await output.save());
}
