import "server-only";

import { requireUser } from "@/lib/auth";
import type { ChatThreadView } from "@/lib/chat/types";

export async function getChatThreads(subjectId: string): Promise<ChatThreadView[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, updated_at")
    .eq("subject_id", subjectId)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data;
}
