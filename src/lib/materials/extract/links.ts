// Links teachers share are often Google Docs, Slides or Drive files. Their
// pages cannot be read as text, but a file shared with "anyone with the link"
// can be downloaded directly (Google's own formats as PDF, which keeps pages
// for citations).

export class LinkError extends Error {}

export type GoogleLink = "docs" | "slides" | "sheets" | "drive";

export type ResolvedLink = { url: string; google: GoogleLink | null };

const DOCS = /^\/(document|presentation|spreadsheets)\/d\/([\w-]{10,})/;

export function resolveDocumentLink(raw: string): ResolvedLink {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, google: null };
  }
  const host = url.hostname.toLowerCase();

  if (host === "docs.google.com") {
    // Published documents (/d/e/.../pub) are already plain web pages.
    if (/^\/(document|presentation|spreadsheets)\/d\/e\//.test(url.pathname)) return { url: raw, google: null };
    const match = DOCS.exec(url.pathname);
    if (match) {
      const [, type, id] = match;
      if (type === "document") return { url: `https://docs.google.com/document/d/${id}/export?format=pdf`, google: "docs" };
      if (type === "presentation") return { url: `https://docs.google.com/presentation/d/${id}/export/pdf`, google: "slides" };
      return { url: `https://docs.google.com/spreadsheets/d/${id}/export?format=pdf`, google: "sheets" };
    }
  }

  if (host === "drive.google.com") {
    if (/\/folders\//.test(url.pathname)) {
      throw new LinkError("Es una carpeta de Google Drive: agrega el enlace de cada archivo por separado.");
    }
    const id = /^\/file\/d\/([\w-]{10,})/.exec(url.pathname)?.[1] ?? url.searchParams.get("id");
    if (id && /^[\w-]{10,}$/.test(id)) {
      return { url: `https://drive.google.com/uc?export=download&id=${id}`, google: "drive" };
    }
  }

  return { url: raw, google: null };
}

export function googleNotSharedMessage(google: GoogleLink): string {
  const what = google === "drive" ? "Este archivo de Google Drive" : "Este documento de Google";
  return `${what} no es público. En Google, abre Compartir → Acceso general → «Cualquier persona con el enlace» (Lector) y vuelve a intentarlo.`;
}
