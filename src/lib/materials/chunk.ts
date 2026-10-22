// Splits extracted text into fragments for the search index. A fragment never
// mixes two pages, slides or photos, so every citation points to exactly one
// place. Video segments are merged until a fragment has enough text.

export type SourceUnit = {
  text: string;
  page?: number | null;
  startSeconds?: number | null;
  section?: string | null;
};

export type ChunkDraft = {
  content: string;
  page: number | null;
  start_seconds: number | null;
  section: string | null;
};

const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;
const OVERLAP_CHARS = 150;

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Pieces no longer than MAX_CHARS, cut at paragraph, then sentence, then word.
function splitLong(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [text];
  const pieces: string[] = [];
  for (const raw of sentences) {
    let sentence = raw.trim();
    while (sentence.length > MAX_CHARS) {
      const cut = sentence.lastIndexOf(" ", MAX_CHARS);
      const at = cut > MAX_CHARS / 2 ? cut : MAX_CHARS;
      pieces.push(sentence.slice(0, at).trim());
      sentence = sentence.slice(at).trim();
    }
    if (sentence) pieces.push(sentence);
  }
  return pieces;
}

function tail(text: string): string {
  if (text.length <= OVERLAP_CHARS) return text;
  const start = text.indexOf(" ", text.length - OVERLAP_CHARS);
  return text.slice(start > 0 ? start + 1 : text.length - OVERLAP_CHARS);
}

function chunkText(text: string): string[] {
  const paragraphs = normalizeText(text)
    .split(/\n{2,}/)
    .flatMap((paragraph) => splitLong(paragraph.trim()))
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > TARGET_CHARS) {
      chunks.push(current);
      current = `${tail(current)}\n\n${paragraph}`;
      if (current.length > MAX_CHARS) current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkUnits(units: SourceUnit[]): ChunkDraft[] {
  const timed = units.length > 0 && units.every((unit) => typeof unit.startSeconds === "number");

  if (timed) {
    // Video: join consecutive segments; the fragment starts at its first one.
    const drafts: ChunkDraft[] = [];
    let buffer = "";
    let start: number | null = null;
    for (const unit of units) {
      const text = normalizeText(unit.text);
      if (!text) continue;
      if (buffer && buffer.length + text.length + 1 > TARGET_CHARS) {
        drafts.push({ content: buffer, page: null, start_seconds: start, section: null });
        buffer = "";
        start = null;
      }
      start ??= unit.startSeconds ?? 0;
      buffer = buffer ? `${buffer} ${text}` : text;
    }
    if (buffer) drafts.push({ content: buffer, page: null, start_seconds: start, section: null });
    return drafts.flatMap((draft) =>
      draft.content.length > MAX_CHARS
        ? splitLong(draft.content).map((content) => ({ ...draft, content }))
        : [draft],
    );
  }

  return units.flatMap((unit) =>
    chunkText(unit.text).map((content) => ({
      content,
      page: unit.page ?? null,
      start_seconds: null,
      section: unit.section ? unit.section.slice(0, 300) : null,
    })),
  );
}

// Joins consecutive fragments for reading, removing the overlap that each
// fragment repeats from the previous one.
export function joinChunkTexts(contents: string[]): string {
  let joined = "";
  for (const content of contents) {
    if (!joined) {
      joined = content;
      continue;
    }
    let overlap = 0;
    for (let size = Math.min(OVERLAP_CHARS + 50, content.length, joined.length); size > 10; size--) {
      if (joined.endsWith(content.slice(0, size))) {
        overlap = size;
        break;
      }
    }
    const rest = content.slice(overlap).replace(/^\s+/, "");
    joined = overlap > 0 ? `${joined}\n\n${rest}` : `${joined}\n\n${content}`;
  }
  return joined;
}
