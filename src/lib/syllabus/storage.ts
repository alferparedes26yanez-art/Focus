import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

import { SYLLABUS_BUCKET } from "./files";
import { storedFileSchema } from "./prepare-files";

// Storage objects are not removed by database cascades, so delete the
// syllabus files of a subject (or of some of its imports) explicitly.
export async function removeSyllabusFiles(
  supabase: ServerSupabase,
  filter: { subjectId: string } | { importIds: string[] },
): Promise<boolean> {
  let query = supabase.from("syllabus_imports").select("files");
  query = "subjectId" in filter ? query.eq("subject_id", filter.subjectId) : query.in("id", filter.importIds);
  const { data, error } = await query;
  if (error) return false;

  const paths = data.flatMap((row) => {
    const files = storedFileSchema.array().safeParse(row.files);
    return files.success ? files.data.map((file) => file.path) : [];
  });
  if (paths.length === 0) return true;

  const { error: removeError } = await supabase.storage.from(SYLLABUS_BUCKET).remove(paths);
  if (removeError) {
    console.error("[storage] could not remove syllabus files:", removeError.message);
    return false;
  }
  return true;
}
