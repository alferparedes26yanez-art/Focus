// Saved pages and text files come in different encodings: UTF-8 from the web,
// Windows-1252 from older tools and some virtual classrooms. Decoding with the
// wrong one breaks every accent ("lÃ­mite"), so the encoding is taken from the
// byte-order mark, then the declared charset, then UTF-8 if it fits.

function decoderFor(label: string | null | undefined): TextDecoder | null {
  if (!label) return null;
  try {
    return new TextDecoder(label.trim().toLowerCase());
  } catch {
    return null;
  }
}

export function charsetFromContentType(contentType: string | null | undefined): string | null {
  return /charset\s*=\s*"?([\w.:-]+)/i.exec(contentType ?? "")?.[1] ?? null;
}

// <meta charset="..."> or <meta http-equiv="Content-Type" content="...; charset=...">
export function sniffHtmlCharset(bytes: Uint8Array): string | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  return (
    /<meta[^>]+charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(head)?.[1] ??
    null
  );
}

export function decodeText(bytes: Uint8Array, declared?: string | null): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));

  const decoder = decoderFor(declared);
  // A page declared as UTF-8 is still checked: saved copies often lie.
  if (decoder && decoder.encoding !== "utf-8") return decoder.decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
