import JSZip from "jszip";

// Text of each slide (and its speaker notes) of a .pptx, in presentation order.

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

// Paragraphs (<a:p>) joined by new lines, runs (<a:t>) inside them by nothing.
function slideText(xml: string): string {
  const paragraphs = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [];
  return paragraphs
    .map((paragraph) =>
      (paragraph.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [])
        .map((run) => decodeXml(run.replace(/<[^>]+>/g, "")))
        .join(""),
    )
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function attribute(tag: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece !== ".") parts.push(piece);
  }
  return parts.join("/");
}

async function relationships(zip: JSZip, path: string): Promise<{ id: string; type: string; target: string }[]> {
  const relsPath = `${path.split("/").slice(0, -1).join("/")}/_rels/${path.split("/").pop()}.rels`;
  const xml = await zip.file(relsPath)?.async("string");
  if (!xml) return [];
  return (xml.match(/<Relationship\s[^>]*>/g) ?? []).map((tag) => ({
    id: attribute(tag, "Id") ?? "",
    type: attribute(tag, "Type") ?? "",
    target: resolvePath(path, attribute(tag, "Target") ?? ""),
  }));
}

export async function readPptxSlides(buffer: Buffer): Promise<{ slide: number; text: string }[]> {
  const zip = await JSZip.loadAsync(buffer);
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presentation) throw new Error("No es un archivo de PowerPoint válido.");

  const rels = await relationships(zip, "ppt/presentation.xml");
  const order = (presentation.match(/<p:sldId\s[^>]*>/g) ?? [])
    .map((tag) => attribute(tag, "r:id"))
    .map((id) => rels.find((rel) => rel.id === id)?.target)
    .filter((target): target is string => Boolean(target));

  const slides: { slide: number; text: string }[] = [];
  for (const [index, path] of order.entries()) {
    const xml = (await zip.file(path)?.async("string")) ?? "";
    let text = slideText(xml);

    const notesPath = (await relationships(zip, path)).find((rel) => rel.type.endsWith("/notesSlide"))?.target;
    const notes = notesPath ? slideText((await zip.file(notesPath)?.async("string")) ?? "") : "";
    // Notes slides repeat the slide number placeholder; keep real notes only.
    const cleanNotes = notes.replace(/^\d+$/gm, "").trim();
    if (cleanNotes) text = `${text}\n\nNotas del presentador: ${cleanNotes}`;

    slides.push({ slide: index + 1, text: text.trim() });
  }
  return slides;
}
