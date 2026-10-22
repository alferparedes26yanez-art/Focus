// Material files accepted in the library. Shared by the browser (validate
// before uploading) and the server (validate again before trusting anything).

export const MATERIALS_BUCKET = "materials";
export const MAX_MATERIAL_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_PHOTOS_PER_MATERIAL = 20;

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const TYPES_BY_EXTENSION: Record<string, string> = {
  pdf: PDF_MIME,
  docx: DOCX_MIME,
  pptx: PPTX_MIME,
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  [PDF_MIME]: "pdf",
  [DOCX_MIME]: "docx",
  [PPTX_MIME]: "pptx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const MATERIAL_ACCEPT = [
  ...Object.keys(TYPES_BY_EXTENSION).map((extension) => `.${extension}`),
  ...new Set(Object.values(TYPES_BY_EXTENSION)),
].join(",");

export type FileMaterialKind = "pdf" | "docx" | "pptx" | "images";

export function resolveMaterialMime(file: { name: string; type: string }): string | null {
  if (EXTENSION_BY_TYPE[file.type]) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[extension] ?? null;
}

export function kindForMime(mimeType: string): FileMaterialKind {
  if (mimeType === PDF_MIME) return "pdf";
  if (mimeType === DOCX_MIME) return "docx";
  if (mimeType === PPTX_MIME) return "pptx";
  return "images";
}

export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Material").slice(0, 300);
}

// Storage-safe name: ASCII only, extension from the MIME type.
export function storageFileName(name: string, mimeType: string): string {
  const extension = EXTENSION_BY_TYPE[mimeType] ?? "bin";
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "archivo"}.${extension}`;
}

export type SelectedMaterialFile = { name: string; size: number; type: string };

// How a selection of files becomes materials: each document is its own
// material; photos become one material (pages of the same notes) or one each.
export type PlannedMaterial = {
  kind: FileMaterialKind;
  title: string;
  files: { name: string; size: number; mimeType: string; index: number }[];
};

export function planMaterials(
  files: SelectedMaterialFile[],
  options: { groupPhotos: boolean; photosTitle?: string },
): { ok: true; materials: PlannedMaterial[] } | { ok: false; error: string } {
  if (files.length === 0) return { ok: false, error: "Elige al menos un archivo." };
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { ok: false, error: `Puedes subir hasta ${MAX_FILES_PER_UPLOAD} archivos a la vez.` };
  }

  const documents: PlannedMaterial[] = [];
  const photos: PlannedMaterial["files"] = [];

  for (const [index, file] of files.entries()) {
    const mimeType = resolveMaterialMime(file);
    if (!mimeType) {
      return {
        ok: false,
        error: `«${file.name}» no es un formato aceptado. Usa PDF, Word, PowerPoint (.pptx) o fotos.`,
      };
    }
    if (file.size <= 0) return { ok: false, error: `«${file.name}» está vacío.` };
    if (file.size > MAX_MATERIAL_FILE_BYTES) return { ok: false, error: `«${file.name}» pesa más de 50 MB.` };

    const entry = { name: file.name, size: file.size, mimeType, index };
    if (kindForMime(mimeType) === "images") photos.push(entry);
    else documents.push({ kind: kindForMime(mimeType), title: titleFromFileName(file.name), files: [entry] });
  }

  if (photos.length > 0 && options.groupPhotos) {
    if (photos.length > MAX_PHOTOS_PER_MATERIAL) {
      return { ok: false, error: `Un grupo de fotos puede tener hasta ${MAX_PHOTOS_PER_MATERIAL} fotos.` };
    }
    const title = options.photosTitle?.trim() || (photos.length === 1 ? titleFromFileName(photos[0].name) : "Fotos de apuntes");
    documents.push({ kind: "images", title: title.slice(0, 300), files: photos });
  } else {
    for (const photo of photos) {
      documents.push({ kind: "images", title: titleFromFileName(photo.name), files: [photo] });
    }
  }

  return { ok: true, materials: documents };
}
