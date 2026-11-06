import type { SourceUnit } from "../chunk";

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/;

// Light clean-up so Markdown reads as text: images go, links keep their text
// and address.
function cleanMarkdown(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, "$1 ($2)")
    .replace(/^\s*[-*+]\s+/, "• ");
}

// Plain text is one section; Markdown is split at its headings so citations
// can name the section.
export function readTextSections(text: string, options: { markdown: boolean }): SourceUnit[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (!options.markdown) {
    const body = lines.join("\n").trim();
    return body ? [{ text: body, section: null }] : [];
  }

  const sections: SourceUnit[] = [];
  let current: { section: string | null; lines: string[] } = { section: null, lines: [] };
  let inCode = false;
  const flush = () => {
    const body = current.lines.join("\n").trim();
    if (body) sections.push({ text: body, section: current.section });
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
    const heading = inCode ? null : HEADING.exec(line);
    if (heading) {
      flush();
      current = { section: heading[2].replace(/[*_`]/g, "").trim() || null, lines: [] };
    } else {
      current.lines.push(inCode ? line : cleanMarkdown(line));
    }
  }
  flush();
  return sections;
}
