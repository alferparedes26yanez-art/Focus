import "server-only";

import { createHash } from "node:crypto";

import { embedTexts } from "@/lib/ai/client";
import { chunkUnits } from "@/lib/materials/chunk";
import type { ServerSupabase } from "@/lib/supabase/server";

import { notebookDocSchema, notebookSections, noteMaterialTitle } from "./document";

export type IndexResult = { status: "indexed" | "unchanged" | "empty"; chunks: number };

// Puts a notebook page in the search index (as a 'note' library entry), only
// when its text, title, date or topic changed since the last time.
export async function indexNotebookPage(input: {
  supabase: ServerSupabase;
  userId: string;
  pageId: string;
  deadline: number;
}): Promise<IndexResult | null> {
  const { supabase, userId, pageId, deadline } = input;
  const { data: page } = await supabase
    .from("notebook_pages")
    .select("id, title, class_date, topic_id, content")
    .eq("id", pageId)
    .maybeSingle();
  if (!page) return null;

  const doc = notebookDocSchema.safeParse(page.content);
  const drafts = doc.success ? chunkUnits(notebookSections(doc.data)) : [];
  const title = noteMaterialTitle(page.title, page.class_date);
  const hash = createHash("sha256")
    .update(JSON.stringify([title, page.topic_id, drafts.map((draft) => [draft.section, draft.content])]))
    .digest("hex");

  const { data: current } = await supabase
    .from("materials")
    .select("content_hash")
    .eq("notebook_page_id", pageId)
    .maybeSingle();
  if (current?.content_hash === hash) return { status: "unchanged", chunks: drafts.length };
  if (!current && drafts.length === 0) return { status: "empty", chunks: 0 };

  const vectors = await embedTexts({
    feature: "material_indexing",
    userId,
    texts: drafts.map((draft) => `${title}${draft.section ? ` — ${draft.section}` : ""}\n\n${draft.content}`),
    purpose: "document",
    deadline,
  });

  const { error } = await supabase.rpc("index_notebook_page", {
    p_page_id: pageId,
    p_title: title,
    p_chunks: drafts.map((draft, index) => ({
      content: draft.content,
      section: draft.section,
      embedding: JSON.stringify(vectors[index]),
    })),
    p_content_hash: hash,
  });
  if (error) throw new Error(error.message);
  return { status: drafts.length > 0 ? "indexed" : "empty", chunks: drafts.length };
}
