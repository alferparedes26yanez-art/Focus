// Material shapes shared by the server loaders and the client components.

export type MaterialKind = "pdf" | "docx" | "pptx" | "images" | "web" | "youtube";
export type MaterialStatus = "uploading" | "queued" | "processing" | "ready" | "failed";
// user: chosen by the student · ai: suggested by the AI · general: whole
// subject · pending: waiting to be classified
export type TopicSource = "user" | "ai" | "general" | "pending";

export type MaterialView = {
  id: string;
  title: string;
  kind: MaterialKind;
  is_syllabus: boolean;
  topic_id: string | null;
  topic_source: TopicSource;
  status: MaterialStatus;
  processed_units: number;
  total_units: number | null;
  duration_seconds: number | null;
  error: string | null;
  source_url: string | null;
  created_at: string;
};

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  pdf: "PDF",
  docx: "Word",
  pptx: "PowerPoint",
  images: "Fotos",
  web: "Página web",
  youtube: "Video",
};

// What a "unit" of progress is for each kind (pages, slides, photos...).
export function progressNoun(kind: MaterialKind, count: number): string {
  const nouns: Record<MaterialKind, [string, string]> = {
    pdf: ["página", "páginas"],
    pptx: ["diapositiva", "diapositivas"],
    images: ["foto", "fotos"],
    docx: ["fragmento", "fragmentos"],
    web: ["fragmento", "fragmentos"],
    youtube: ["parte", "partes"],
  };
  return nouns[kind][count === 1 ? 0 : 1];
}

// Unclassified: the AI has not filed it yet, or its topic was deleted.
export function isUnclassified(material: Pick<MaterialView, "topic_id" | "topic_source">): boolean {
  return material.topic_id === null && material.topic_source !== "general";
}

// Link to a place inside a material: a page, slide or photo, a second of a
// video, or a fragment.
export function materialHref(
  subjectId: string,
  materialId: string,
  at: { page?: number | null; seconds?: number | null; chunkId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (at.page) params.set("page", String(at.page));
  if (typeof at.seconds === "number") params.set("t", String(Math.floor(at.seconds)));
  if (at.chunkId) params.set("chunk", at.chunkId);
  const query = params.toString();
  return `/subjects/${subjectId}/materials/${materialId}${query ? `?${query}` : ""}`;
}
