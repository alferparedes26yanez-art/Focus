"use client";

import { NOTEBOOK_BUCKET, NOTEBOOK_IMAGE_ROUTE } from "@/lib/notebook/document";
import { createClient } from "@/lib/supabase/client";

const MAX_SIDE = 1600;
const MAX_BYTES = 10 * 1024 * 1024;
const KEEP_AS_IS_BYTES = 400 * 1024;

export class NotebookImageError extends Error {}

// Phone photos are several MB: they are resized to 1600 px and saved as JPEG
// before uploading. Small images, GIFs and formats the browser cannot decode
// (HEIC outside Safari) are uploaded as they are.
async function prepare(file: File): Promise<{ blob: Blob; type: string; extension: string }> {
  const original = { blob: file as Blob, type: file.type || "image/jpeg", extension: file.name.split(".").pop()?.toLowerCase() || "jpg" };
  if (file.type === "image/gif" || file.size <= KEEP_AS_IS_BYTES) return original;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? { blob, type: "image/jpeg", extension: "jpg" } : original;
  } catch {
    return original;
  }
}

// Uploads an image of a page and returns its storage path and the address the
// editor shows it from.
export async function uploadNotebookImage(
  file: File,
  folder: { userId: string; subjectId: string; pageId: string },
): Promise<{ path: string; src: string }> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new NotebookImageError("Solo se pueden pegar imágenes.");
  }
  const { blob, type, extension } = await prepare(file);
  if (blob.size > MAX_BYTES) throw new NotebookImageError("La imagen pesa más de 10 MB.");

  const path = `${folder.userId}/${folder.subjectId}/${folder.pageId}/${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "") || "jpg"}`;
  const { error } = await createClient().storage.from(NOTEBOOK_BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (error) throw new NotebookImageError("No se pudo subir la imagen. Revisa tu conexión.");
  return { path, src: `${NOTEBOOK_IMAGE_ROUTE}${path.split("/").map(encodeURIComponent).join("/")}` };
}
