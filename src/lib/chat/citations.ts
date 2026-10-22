// Sources given to the assistant and the citations kept from its answer. Only
// numbers that were really given can be cited: anything else is removed, so
// the app never shows an invented reference.

import { formatDuration } from "@/lib/materials/extract/youtube";
import type { MaterialKind } from "@/lib/materials/types";

export type ChatSource = {
  n: number;
  chunk_id: string;
  material_id: string;
  title: string;
  kind: MaterialKind;
  page: number | null;
  start_seconds: number | null;
  section: string | null;
  source_url: string | null;
  content: string;
};

export type Citation = Omit<ChatSource, "content">;

export const GENERAL_KNOWLEDGE_MARK = "**Conocimiento general:**";

// Where in the material: "p. 7", "diapositiva 3", "foto 2", "min 12:05".
export function locationLabel(source: Pick<Citation, "kind" | "page" | "start_seconds" | "section">): string | null {
  if (source.kind === "youtube" && source.start_seconds !== null) return `min ${formatDuration(source.start_seconds)}`;
  if (source.page !== null) {
    if (source.kind === "pptx") return `diapositiva ${source.page}`;
    if (source.kind === "images") return `foto ${source.page}`;
    return `p. ${source.page}`;
  }
  return source.section ? `«${source.section}»` : null;
}

export function sourceLabel(source: Pick<Citation, "title" | "kind" | "page" | "start_seconds" | "section">): string {
  const location = locationLabel(source);
  return location ? `${source.title}, ${location}` : source.title;
}

// "[1, 3]" and "[1-3]" become "[1][3]" / "[1][2][3]" before validating.
function expandGroups(text: string): string {
  return text
    .replace(/\[(\d{1,2})\s*[-–]\s*(\d{1,2})\]/g, (match, from: string, to: string) => {
      const start = Number(from);
      const end = Number(to);
      if (end < start || end - start > 10) return match;
      return Array.from({ length: end - start + 1 }, (_, index) => `[${start + index}]`).join("");
    })
    .replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\]/g, (_match, list: string) =>
      list
        .split(",")
        .map((n) => `[${n.trim()}]`)
        .join(""),
    );
}

function toCitation(source: ChatSource): Citation {
  return {
    n: source.n,
    chunk_id: source.chunk_id,
    material_id: source.material_id,
    title: source.title,
    kind: source.kind,
    page: source.page,
    start_seconds: source.start_seconds,
    section: source.section,
    source_url: source.source_url,
  };
}

// Keeps the citations of the answer that point to given sources, in order of
// first appearance, and removes the markers that do not.
export function finalizeAnswer(text: string, sources: ChatSource[]) {
  const byNumber = new Map(sources.map((source) => [source.n, source]));
  const cited: Citation[] = [];
  const content = expandGroups(text)
    .replace(/ ?\[(\d{1,2})\]/g, (match, value: string) => {
      const source = byNumber.get(Number(value));
      if (!source) return "";
      if (!cited.some((citation) => citation.n === source.n)) cited.push(toCitation(source));
      return match;
    })
    .trim();

  return {
    content,
    citations: cited,
    usedGeneralKnowledge: content.includes(GENERAL_KNOWLEDGE_MARK),
  };
}

// Earlier answers go back to the model without their source numbers, which
// referred to another list of sources.
export function stripCitationMarkers(text: string): string {
  return expandGroups(text).replace(/ ?\[\d{1,2}\]/g, "");
}
