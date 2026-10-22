import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

import type { SourceUnit } from "../chunk";
import { htmlToSections } from "./html";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

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

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function readWebPage(raw: string): Promise<{ title: string | null; sections: SourceUnit[] }> {
  let url = await assertPublicUrl(raw);
  let response: Response | null = null;

  for (let redirects = 0; ; redirects++) {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; FocusStudyBot/1.0)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "es,en;q=0.8",
      },
    }).catch(() => {
      throw new WebPageError("No pudimos abrir la página. Revisa el enlace.");
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) throw new WebPageError("La página redirige demasiadas veces.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }

  if (!response.ok) throw new WebPageError(`La página respondió con un error (${response.status}).`);
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/.test(type)) {
    throw new WebPageError("El enlace no es una página web. Si es un PDF, descárgalo y súbelo como archivo.");
  }

  const html = await readLimited(response);
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const title = (article?.title ?? document.querySelector("title")?.textContent ?? "").trim() || null;
  const sections = htmlToSections(article?.content ?? document.body?.innerHTML ?? "");
  if (sections.length === 0) {
    throw new WebPageError("No encontramos texto en esa página (puede necesitar iniciar sesión).");
  }
  return { title, sections };
}

// Title shown until the page is read; replaced by the page's own title.
export function webPlaceholderTitle(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 300);
  } catch {
    return raw.slice(0, 300);
  }
}
