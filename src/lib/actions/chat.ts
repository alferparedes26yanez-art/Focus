"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import type { ChatMode } from "@/lib/ai/prompts";
import { requireUser } from "@/lib/auth";
import { parseCitations, type ChatMessageView } from "@/lib/chat/types";

import type { ActionResult } from "./types";

const idSchema = z.uuid();
const MAX_MESSAGES = 200;

export async function loadChatThread(threadId: string): Promise<ActionResult<{ messages: ChatMessageView[] }>> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(threadId).success) return { ok: false, error: "Conversación no válida." };

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, mode, citations, used_general_knowledge")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);
  if (error) return { ok: false, error: "No se pudo abrir la conversación." };

  return {
    ok: true,
    data: {
      messages: data.map((message) => ({
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
        mode: message.mode as ChatMode | null,
        citations: parseCitations(message.citations),
        used_general_knowledge: message.used_general_knowledge,
      })),
    },
  };
}

export async function deleteChatThread(threadId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(threadId).success) return { ok: false, error: "Conversación no válida." };

  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId);
  if (error) return { ok: false, error: "No se pudo borrar la conversación." };
  refresh();
  return { ok: true };
}
