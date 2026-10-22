import "server-only";

import mammoth from "mammoth";

import type { SourceUnit } from "../chunk";
import { htmlToSections } from "./html";

// Word has no page numbers in the file, so fragments are cited by section.
export async function readDocxSections(buffer: Buffer): Promise<SourceUnit[]> {
  const { value } = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );
  return htmlToSections(value);
}
