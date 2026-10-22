import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";
import { storedFileSchema } from "@/lib/syllabus/prepare-files";

import { MATERIALS_BUCKET } from "./files";

// Storage objects are not removed by database cascades, so delete the files
// of some materials (or of a whole subject) explicitly. The syllabus entry of
// the library points to the syllabus files, which belong to its import.
export async function removeMaterialFiles(
  supabase: ServerSupabase,
  filter: { subjectId: string } | { materialIds: string[] },
): Promise<boolean> {
  let query = supabase.from("materials").select("files").eq("storage_bucket", MATERIALS_BUCKET);
  query = "subjectId" in filter ? query.eq("subject_id", filter.subjectId) : query.in("id", filter.materialIds);
  const { data, error } = await query;
  if (error) return false;

  const paths = data.flatMap((row) => {
    const files = storedFileSchema.array().safeParse(row.files);
    return files.success ? files.data.map((file) => file.path) : [];
  });

  for (let start = 0; start < paths.length; start += 1000) {
    const { error: removeError } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .remove(paths.slice(start, start + 1000));
    if (removeError) {
      console.error("[storage] could not remove material files:", removeError.message);
      return false;
    }
  }
  return true;
}
