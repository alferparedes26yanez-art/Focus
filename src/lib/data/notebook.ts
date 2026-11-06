import "server-only";

import { requireUser } from "@/lib/auth";
import { toDataError } from "@/lib/data/errors";
import { EMPTY_NOTEBOOK_DOC, notebookDocSchema, notebookPreview, UNTITLED_PAGE } from "@/lib/notebook/document";
import type { NotebookPageSummary, NotebookPageView } from "@/lib/notebook/types";

export async function getNotebookPages(subjectId: string): Promise<NotebookPageSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("notebook_pages")
    .select("id, title, class_date, topic_id, plain_text, created_at, updated_at")
    .eq("subject_id", subjectId)
    .order("class_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw toDataError(error);
  return (
    data
      // Created and never touched: not shown (and cleaned up later).
      .filter((page) => !(page.title === UNTITLED_PAGE && !page.plain_text && page.created_at === page.updated_at))
      .map((page) => ({
        id: page.id,
        title: page.title,
        class_date: page.class_date,
        topic_id: page.topic_id,
        updated_at: page.updated_at,
        preview: notebookPreview(page.plain_text),
      }))
  );
}

export async function getNotebookPage(subjectId: string, pageId: string): Promise<NotebookPageView | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("notebook_pages")
    .select("id, subject_id, title, class_date, topic_id, content, updated_at")
    .eq("id", pageId)
    .eq("subject_id", subjectId)
    .maybeSingle();
  if (error) throw toDataError(error);
  if (!data) return null;
  // A document without blocks leaves the editor without a valid cursor.
  const content = notebookDocSchema.safeParse(data.content);
  return { ...data, content: content.success && content.data.content?.length ? content.data : EMPTY_NOTEBOOK_DOC };
}
