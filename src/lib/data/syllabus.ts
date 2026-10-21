import "server-only";

import { requireUser } from "@/lib/auth";
import { syllabusDraftSchema } from "@/lib/syllabus/schemas";

export async function getSyllabusImport(importId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("syllabus_imports")
    .select("id, subject_id, status, extraction, error, files")
    .eq("id", importId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const draft = data.extraction ? syllabusDraftSchema.safeParse(data.extraction) : null;
  return {
    id: data.id,
    subjectId: data.subject_id,
    status: data.status as "pending" | "processing" | "review" | "applied" | "failed",
    error: data.error,
    draft: draft?.success ? draft.data : null,
  };
}
