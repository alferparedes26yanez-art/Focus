import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type { SourceUnit } from "../chunk";
import { DOCX_MIME, PDF_MIME, PPTX_MIME, resolveMaterialMime } from "../files";
import { charsetFromContentType, decodeText } from "./decode";
import { readHtmlArticle } from "./html";

// Only the first 3 MB of a page are read: past that it is not an article.
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 6;

export class WebPageError extends Error {}

// Private, loopback, link-local and other non-public addresses.
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    return ip === "::1" || ip === "::" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  }
  return true;
}

// Only public http(s) pages: the server must never be used to reach internal
// addresses (SSRF).
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebPageError("El enlace no es válido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new WebPageError("Solo se aceptan enlaces http o https.");
  }
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) {
    throw new WebPageError("Ese enlace no se puede abrir.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new WebPageError("Ese enlace no se puede abrir.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new WebPageError("No encontramos ese sitio web.");
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new WebPageError("Ese enlace no se puede abrir.");
  }
  return url;
}

export type FetchedResource = {
  url: URL;
  contentType: string;
  fileName: string | null;
  bytes: Uint8Array;
};

async function readBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new WebPageError(`El archivo del enlace pesa más de ${Math.round(maxBytes / (1024 * 1024))} MB.`);
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ""));
    } catch {
      // Fall back to the plain filename below.
    }
  }
  return /filename\s*=\s*"?([^";]+)"?/i.exec(header)?.[1]?.trim() ?? null;
}

// Downloads a public link, checking every redirect against internal addresses.
export async function fetchPublicResource(
  raw: string,
  options: { maxBytes: number; timeoutMs: number },
): Promise<FetchedResource> {
  let url = await assertPublicUrl(raw);
  const signal = AbortSignal.timeout(options.timeoutMs);
  let response: Response;

  for (let redirects = 0; ; redirects++) {
    response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; FocusStudyBot/1.0)",
        accept: "text/html,application/xhtml+xml,application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        "accept-language": "es,en;q=0.8",
      },
    }).catch(() => {
      throw new WebPageError("No pudimos abrir el enlace. Revisa que esté bien escrito.");
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) throw new WebPageError("El enlace redirige demasiadas veces.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }

  if (!response.ok) throw new WebPageError(`El enlace respondió con un error (${response.status}).`);
  return {
    url,
    contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
    fileName: fileNameFromDisposition(response.headers.get("content-disposition")),
    bytes: await readBody(response, options.maxBytes),
  };
}

export function isHtmlResource(resource: Pick<FetchedResource, "contentType">): boolean {
  return /text\/html|application\/xhtml/.test(resource.contentType);
}

// A link to a PDF, Word or PowerPoint file: by its type, its name, or (for
// servers that send no useful type) the bytes of a PDF.
export function documentMimeOf(resource: Pick<FetchedResource, "contentType" | "fileName" | "url" | "bytes">): string | null {
  const documents = [PDF_MIME, DOCX_MIME, PPTX_MIME];
  const type = resource.contentType.split(";")[0].trim();
  if (documents.includes(type)) return type;
  const name = resource.fileName ?? decodeURIComponent(resource.url.pathname.split("/").pop() ?? "");
  const byName = resolveMaterialMime({ name, type: "" });
  if (byName && documents.includes(byName)) return byName;
  const head = new TextDecoder("latin1").decode(resource.bytes.subarray(0, 5));
  return head === "%PDF-" ? PDF_MIME : null;
}

// The text of a web page already downloaded.
export function readFetchedPage(resource: FetchedResource): { title: string | null; sections: SourceUnit[] } {
  const bytes = resource.bytes.subarray(0, MAX_PAGE_BYTES);
  const page = readHtmlArticle(decodeText(bytes, charsetFromContentType(resource.contentType)));
  if (page.sections.length === 0) {
    throw new WebPageError("No encontramos texto en esa página (puede necesitar iniciar sesión).");
  }
  return page;
}

// Title shown until the link is read; replaced by the page's or file's own.
export function webPlaceholderTitle(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname === "docs.google.com") return "Documento de Google";
    if (url.hostname === "drive.google.com") return "Archivo de Google Drive";
    return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 300);
  } catch {
    return raw.slice(0, 300);
  }
}
