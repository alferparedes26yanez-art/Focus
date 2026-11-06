import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

import { NOTEBOOK_BUCKET } from "./document";

// Notebook images live under "<user>/<subject>/<page>/". Storage does not
// delete them with the database rows, so a page (or a whole subject) removes
// its folder explicitly.
async function listFiles(supabase: ServerSupabase, folder: string): Promise<string[] | null> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(NOTEBOOK_BUCKET).list(folder, { limit: 1000, offset });
    if (error) return null;
    paths.push(...data.filter((item) => item.id).map((item) => `${folder}/${item.name}`));
    if (data.length < 1000) return paths;
  }
}

async function removePaths(supabase: ServerSupabase, paths: string[]): Promise<boolean> {
  for (let start = 0; start < paths.length; start += 1000) {
    const { error } = await supabase.storage.from(NOTEBOOK_BUCKET).remove(paths.slice(start, start + 1000));
    if (error) {
      console.error("[storage] could not remove notebook images:", error.message);
      return false;
    }
  }
  return true;
}

export async function removeNotebookPageFiles(
  supabase: ServerSupabase,
  userId: string,
  subjectId: string,
  pageId: string,
): Promise<boolean> {
  const paths = await listFiles(supabase, `${userId}/${subjectId}/${pageId}`);
  return paths !== null && removePaths(supabase, paths);
}

export async function removeNotebookSubjectFiles(
  supabase: ServerSupabase,
  userId: string,
  subjectId: string,
): Promise<boolean> {
  const { data: pages, error } = await supabase.storage.from(NOTEBOOK_BUCKET).list(`${userId}/${subjectId}`, { limit: 1000 });
  if (error) return false;
  for (const page of pages.filter((item) => !item.id)) {
    if (!(await removeNotebookPageFiles(supabase, userId, subjectId, page.name))) return false;
  }
  return true;
}
