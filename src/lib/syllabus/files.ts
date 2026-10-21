// Which syllabus files are accepted. Shared by the browser (to validate before
// uploading) and the server (to validate again before trusting anything).

export const SYLLABUS_BUCKET = "syllabi";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGES = 10;

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: DOCX_MIME,
};

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export const ACCEPT_ATTRIBUTE = [
  ...Object.keys(DOCUMENT_TYPES),
  ...Object.keys(IMAGE_TYPES),
]
  .map((ext) => `.${ext}`)
  .concat(Object.values(DOCUMENT_TYPES), Object.values(IMAGE_TYPES))
  .join(",");

export type SelectedFile = { name: string; size: number; type: string };
export type AcceptedFile = { name: string; size: number; mimeType: string };

// Browsers sometimes report HEIC photos or Word files with an empty type, so
// the extension decides when the type is missing or generic.
export function resolveMimeType(file: { name: string; type: string }): string | null {
  const known = new Set([...Object.values(DOCUMENT_TYPES), ...Object.values(IMAGE_TYPES)]);
  if (known.has(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return DOCUMENT_TYPES[extension] ?? IMAGE_TYPES[extension] ?? null;
}

export function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

type ValidationResult =
  | { ok: true; files: AcceptedFile[] }
  | { ok: false; error: string };

export function validateSyllabusFiles(files: SelectedFile[]): ValidationResult {
  if (files.length === 0) {
    return { ok: false, error: "Elige el archivo de tu sílabo." };
  }

  const accepted: AcceptedFile[] = [];
  for (const file of files) {
    const mimeType = resolveMimeType(file);
    if (!mimeType) {
      return {
        ok: false,
        error: `«${file.name}» no es un formato aceptado. Usa PDF, Word (.docx) o fotos (JPG, PNG, HEIC).`,
      };
    }
    if (file.size <= 0) {
      return { ok: false, error: `«${file.name}» está vacío.` };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: `«${file.name}» pesa más de 10 MB.` };
    }
    accepted.push({ name: file.name, size: file.size, mimeType });
  }

  const images = accepted.filter((file) => isImageMime(file.mimeType));
  if (images.length > 0 && images.length !== accepted.length) {
    return { ok: false, error: "Sube un documento (PDF o Word) o fotos, pero no ambos a la vez." };
  }
  if (images.length === 0 && accepted.length > 1) {
    return { ok: false, error: "Sube un solo documento: el PDF o Word de tu sílabo." };
  }
  if (images.length > MAX_IMAGES) {
    return { ok: false, error: `Puedes subir hasta ${MAX_IMAGES} fotos.` };
  }
  if (accepted.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
    return { ok: false, error: "Los archivos pesan más de 15 MB en total." };
  }

  return { ok: true, files: accepted };
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  [DOCX_MIME]: "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// Storage-safe file name: ASCII only, extension taken from the MIME type.
export function safeFileName(name: string, mimeType: string): string {
  const extension = EXTENSION_BY_MIME[mimeType] ?? "bin";
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "archivo"}.${extension}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
