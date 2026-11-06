// Notebook pages are stored as the editor's JSON (Tiptap/ProseMirror). These
// helpers read that JSON on the server: the text for previews, the sections
// for the search index, the images it uses. Shared with the browser.

import { z } from "zod";

import type { SourceUnit } from "@/lib/materials/chunk";

export type NotebookNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NotebookNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export const EMPTY_NOTEBOOK_DOC: NotebookNode = { type: "doc", content: [{ type: "paragraph" }] };
export const UNTITLED_PAGE = "Sin título";

// Images are shown through this route, which checks the session and redirects
// to a short-lived link to the private file.
export const NOTEBOOK_IMAGE_ROUTE = "/api/notebook/images/";
export const NOTEBOOK_BUCKET = "notebook";
export const MAX_NOTEBOOK_DOC_CHARS = 800_000;

const nodeSchema: z.ZodType<NotebookNode> = z.lazy(() =>
  z.object({
    type: z.string().max(40),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(nodeSchema).optional(),
    text: z.string().optional(),
    marks: z.array(z.object({ type: z.string().max(40), attrs: z.record(z.string(), z.unknown()).optional() })).optional(),
  }),
);

export const notebookDocSchema = z.object({ type: z.literal("doc"), content: z.array(nodeSchema).optional() });

function inlineText(node: NotebookNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "image") return imageText(node);
  return (node.content ?? []).map(inlineText).join("");
}

function imageText(node: NotebookNode): string {
  const text = typeof node.attrs?.alt === "string" ? node.attrs.alt.trim() : "";
  return text ? `[Imagen: ${text}]` : "";
}

// Text lines of a block, with list bullets, task boxes and table cells.
function blockLines(node: NotebookNode, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "codeBlock": {
      const text = inlineText(node).trim();
      return text ? [text] : [];
    }
    case "image": {
      const text = imageText(node);
      return text ? [text] : [];
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return (node.content ?? []).flatMap((item, index) => {
        const marker =
          node.type === "orderedList" ? `${index + 1}.` : node.type === "taskList" ? (item.attrs?.checked ? "☑" : "☐") : "•";
        const [first, ...rest] = (item.content ?? []).flatMap((child) =>
          ["bulletList", "orderedList", "taskList"].includes(child.type) ? blockLines(child, depth + 1) : blockLines(child, depth),
        );
        return first === undefined ? [] : [`${indent}${marker} ${first.trimStart()}`, ...rest];
      });
    case "table":
      return (node.content ?? []).flatMap((row) => {
        const cells = (row.content ?? []).map((cell) => (cell.content ?? []).flatMap((child) => blockLines(child)).join(" ").trim());
        return cells.some(Boolean) ? [cells.join(" | ")] : [];
      });
    case "blockquote":
      return (node.content ?? []).flatMap((child) => blockLines(child, depth)).map((line) => `> ${line}`);
    default:
      return (node.content ?? []).flatMap((child) => blockLines(child, depth));
  }
}

// Sections start at each heading, so the chat can cite "«Normalización»".
export function notebookSections(doc: NotebookNode): SourceUnit[] {
  const sections: SourceUnit[] = [];
  let current: { section: string | null; lines: string[] } = { section: null, lines: [] };
  const flush = () => {
    const text = current.lines.join("\n").trim();
    if (text) sections.push({ text, section: current.section });
  };
  for (const node of doc.content ?? []) {
    if (node.type === "heading") {
      flush();
      current = { section: inlineText(node).replace(/\s+/g, " ").trim().slice(0, 300) || null, lines: [] };
    } else {
      current.lines.push(...blockLines(node));
    }
  }
  flush();
  return sections;
}

export function notebookPlainText(doc: NotebookNode): string {
  return notebookSections(doc)
    .map((section) => (section.section ? `${section.section}\n${section.text}` : section.text))
    .join("\n\n");
}

export function notebookImagePaths(doc: NotebookNode): string[] {
  const paths: string[] = [];
  const walk = (node: NotebookNode) => {
    if (node.type === "image" && typeof node.attrs?.src === "string" && node.attrs.src.startsWith(NOTEBOOK_IMAGE_ROUTE)) {
      paths.push(decodeURIComponent(node.attrs.src.slice(NOTEBOOK_IMAGE_ROUTE.length)));
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return paths;
}

const dayMonth = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });

export function formatClassDate(classDate: string): string {
  return dayMonth.format(new Date(`${classDate}T00:00:00Z`)).replace(".", "");
}

// Name of the page in the library and in citations: "Apuntes del 6 nov · Clase 1".
export function noteMaterialTitle(title: string, classDate: string): string {
  return `Apuntes del ${formatClassDate(classDate)} · ${title}`.slice(0, 300);
}

export function notebookPreview(plainText: string, length = 140): string {
  const text = plainText.replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}
