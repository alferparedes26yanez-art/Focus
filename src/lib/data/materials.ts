import "server-only";

import { requireUser } from "@/lib/auth";
import { storedFileSchema } from "@/lib/syllabus/prepare-files";
import type { MaterialView } from "@/lib/materials/types";

const LIST_COLUMNS =
  "id, title, kind, is_syllabus, topic_id, topic_source, status, processed_units, total_units, duration_seconds, error, source_url, created_at";

export async function getSubjectMaterials(subjectId: string): Promise<MaterialView[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("materials")
    .select(LIST_COLUMNS)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as MaterialView[];
}

// Page-based material shows this many pages at a time in the viewer.
export const VIEWER_PAGE_WINDOW = 20;
const MAX_VIEWER_CHUNKS = 600;
const SIGNED_URL_SECONDS = 60 * 60;

export type ViewerChunk = {
  id: string;
  position: number;
  page: number | null;
  start_seconds: number | null;
  section: string | null;
  content: string;
};

export async function getMaterialDetail(subjectId: string, materialId: string, focusPage: number | null) {
  const { supabase } = await requireUser();
  const { data: material, error } = await supabase
    .from("materials")
    .select(
      `${LIST_COLUMNS}, storage_bucket, files, subject:subjects(id, name, color), topic:topics(id, title)`,
    )
    .eq("id", materialId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!material || !material.subject) return null;

  const paged = material.kind === "pdf" || material.kind === "pptx" || material.kind === "images";
  const totalPages = paged ? (material.total_units ?? material.processed_units) : 0;
  const firstPage = paged && focusPage ? Math.max(1, focusPage - 2) : 1;
  const lastPage = firstPage + VIEWER_PAGE_WINDOW - 1;

  let query = supabase
    .from("chunks")
    .select("id, position, page, start_seconds, section, content")
    .eq("material_id", materialId)
    .order("position", { ascending: true })
    .limit(MAX_VIEWER_CHUNKS);
  if (paged) query = query.gte("page", firstPage).lte("page", lastPage);
  const { data: chunks, error: chunksError } = await query;
  if (chunksError) throw new Error(chunksError.message);

  const files = storedFileSchema.array().safeParse(material.files);
  const stored = files.success ? files.data : [];
  let fileUrls: { name: string; mimeType: string; url: string }[] = [];
  if (stored.length > 0) {
    const { data: signed } = await supabase.storage
      .from(material.storage_bucket)
      .createSignedUrls(
        stored.map((file) => file.path),
        SIGNED_URL_SECONDS,
      );
    fileUrls = stored.flatMap((file, index) => {
      const url = signed?.[index]?.signedUrl;
      return url ? [{ name: file.name, mimeType: file.mime_type, url }] : [];
    });
  }

  return {
    material: material as unknown as MaterialView,
    subject: material.subject as { id: string; name: string; color: string },
    topic: material.topic as { id: string; title: string } | null,
    chunks: chunks as ViewerChunk[],
    files: fileUrls,
    window: paged ? { firstPage, lastPage: Math.min(lastPage, totalPages || lastPage), totalPages } : null,
  };
}

export type MaterialDetail = NonNullable<Awaited<ReturnType<typeof getMaterialDetail>>>;
