import { parseHTML } from "linkedom";

import type { SourceUnit } from "../chunk";

const HEADING = /^H[1-4]$/;
const BLOCK = new Set(["P", "LI", "TD", "TH", "PRE", "BLOCKQUOTE", "FIGCAPTION", "DT", "DD", "H5", "H6"]);

// Turns HTML (Word converted by mammoth, or a web article) into sections that
// start at each heading, so citations can name the section.
export function htmlToSections(html: string): SourceUnit[] {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const sections: SourceUnit[] = [];
  let current: { section: string | null; parts: string[] } = { section: null, parts: [] };

  const flush = () => {
    const text = current.parts.join("\n\n").trim();
    if (text) sections.push({ text, section: current.section });
  };

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toUpperCase();
      if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "IMG", "NAV", "FOOTER"].includes(tag)) continue;
      if (HEADING.test(tag)) {
        flush();
        const title = (child.textContent ?? "").replace(/\s+/g, " ").trim();
        current = { section: title || null, parts: [] };
      } else if (BLOCK.has(tag) && !child.querySelector("p, li, table, h1, h2, h3, h4")) {
        const text = (child.textContent ?? "").replace(/[ \t]+/g, " ").trim();
        if (text) current.parts.push(tag === "LI" ? `• ${text}` : text);
      } else if (tag === "TR") {
        const cells = Array.from(child.children)
          .map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean);
        if (cells.length > 0) current.parts.push(cells.join(" | "));
      } else if (child.children.length > 0) {
        walk(child);
      } else {
        const text = (child.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text) current.parts.push(text);
      }
    }
  };

  walk(document.body);
  flush();
  return sections;
}
