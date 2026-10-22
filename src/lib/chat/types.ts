import { z } from "zod";

import type { ChatMode } from "@/lib/ai/prompts";

import type { Citation } from "./citations";

export const CHAT_MODES: { value: ChatMode; label: string; hint: string }[] = [
  { value: "simple", label: "Simple", hint: "Corto y con un ejemplo" },
  { value: "detailed", label: "Detallada", hint: "Paso a paso y a fondo" },
  { value: "exam", label: "Nivel examen", hint: "Como respuesta de prueba" },
  { value: "tutor", label: "Tutor", hint: "Te guía con preguntas" },
];

export const citationSchema = z.object({
  n: z.number().int(),
  chunk_id: z.string(),
  material_id: z.string(),
  title: z.string(),
  kind: z.enum(["pdf", "docx", "pptx", "images", "web", "youtube"]),
  page: z.number().int().nullable(),
  start_seconds: z.number().int().nullable(),
  section: z.string().nullable(),
  source_url: z.string().nullable(),
});

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: ChatMode | null;
  citations: Citation[];
  used_general_knowledge: boolean;
};

export type ChatThreadView = { id: string; title: string; updated_at: string };

export function parseCitations(value: unknown): Citation[] {
  const parsed = citationSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

// Lines of the /api/chat response (NDJSON).
export type ChatStreamEvent =
  | { type: "meta"; threadId: string; title: string; userMessageId: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: ChatMessageView }
  | { type: "error"; error: string };
