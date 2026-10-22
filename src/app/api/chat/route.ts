import type { Content } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { embedTexts, streamText } from "@/lib/ai/client";
import { AiError } from "@/lib/ai/errors";
import { chatSystemPrompt, chatUserTurn } from "@/lib/ai/prompts";
import { getSession } from "@/lib/auth";
import { finalizeAnswer, sourceLabel, stripCitationMarkers, type ChatSource } from "@/lib/chat/citations";
import { answeredTurns } from "@/lib/chat/history";
import type { ChatStreamEvent } from "@/lib/chat/types";
import type { MaterialKind } from "@/lib/materials/types";

export const maxDuration = 60;

const TIME_BUDGET_MS = 55_000;
const HISTORY_MESSAGES = 8;
const SOURCE_COUNT = 8;

const requestSchema = z.object({
  subjectId: z.uuid(),
  threadId: z.uuid().nullable(),
  message: z.string().trim().min(1).max(4000),
  mode: z.enum(["simple", "detailed", "exam", "tutor"]),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function threadTitle(message: string): string {
  const text = message.replace(/\s+/g, " ").trim();
  return text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text;
}

// Answers a question about the subject with the student's own material:
// finds the most relevant fragments, asks the model to answer citing them and
// streams the answer as NDJSON (meta, delta..., done | error).
export async function POST(request: Request) {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Escribe tu pregunta.", 400);
  const { subjectId, message, mode } = parsed.data;
  let threadId = parsed.data.threadId;

  const { supabase, userId } = await getSession();
  if (!userId) return errorResponse("Tu sesión expiró. Vuelve a iniciar sesión.", 401);

  const { data: subject } = await supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle();
  if (!subject) return errorResponse("No encontramos esta materia.", 404);

  let history: { role: string; content: string }[] = [];
  if (threadId) {
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", threadId)
      .eq("subject_id", subjectId)
      .maybeSingle();
    if (!thread) return errorResponse("Esta conversación ya no existe.", 404);
    const { data: previous } = await supabase
      .from("messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES);
    history = answeredTurns((previous ?? []).reverse());
  }

  let sources: ChatSource[];
  let stream: AsyncGenerator<string>;
  try {
    // Short follow-ups ("¿y en la práctica?") are searched with the previous
    // question so they find the same material.
    const lastQuestion = history.filter((item) => item.role === "user").at(-1)?.content;
    const query = message.length < 80 && lastQuestion ? `${lastQuestion}\n${message}` : message;
    const [vector] = await embedTexts({
      feature: "chat",
      userId,
      texts: [query.slice(0, 4000)],
      purpose: "query",
      deadline,
    });

    const { data: matches, error: searchError } = await supabase.rpc("match_chunks", {
      p_subject_id: subjectId,
      p_query_embedding: JSON.stringify(vector),
      p_match_count: SOURCE_COUNT,
    });
    if (searchError) throw new Error(searchError.message);

    sources = (matches ?? []).map((match, index) => ({
      n: index + 1,
      chunk_id: match.chunk_id,
      material_id: match.material_id,
      title: match.material_title,
      kind: match.material_kind as MaterialKind,
      page: match.page ?? null,
      start_seconds: match.start_seconds ?? null,
      section: match.section ?? null,
      source_url: match.source_url ?? null,
      content: match.content,
    }));

    const contents: Content[] = [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.role === "assistant" ? stripCitationMarkers(item.content) : item.content }],
      })),
      {
        role: "user",
        parts: [
          {
            text: chatUserTurn({
              question: message,
              sources: sources.map((source) => ({ n: source.n, label: sourceLabel(source), content: source.content })),
            }),
          },
        ],
      },
    ];

    stream = await streamText({
      feature: "chat",
      tier: "main",
      userId,
      systemInstruction: chatSystemPrompt({ subjectName: subject.name, mode }),
      contents,
      maxOutputTokens: 8_192,
      deadline,
    });
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === "budget_exceeded" ? 402 : error.code === "busy" ? 503 : 502;
      return errorResponse(error.userMessage, status);
    }
    console.error("[chat] could not start the answer:", error);
    return errorResponse("No se pudo responder. Inténtalo de nuevo.", 500);
  }

  // The question is saved once the answer has started.
  const title = threadTitle(message);
  if (!threadId) {
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({ subject_id: subjectId, title })
      .select("id")
      .single();
    if (error) return errorResponse("No se pudo guardar la conversación.", 500);
    threadId = thread.id;
  }
  const { data: userMessage, error: userMessageError } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, role: "user", content: message, mode })
    .select("id")
    .single();
  if (userMessageError) return errorResponse("No se pudo guardar tu pregunta.", 500);

  const savedThreadId = threadId;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser left; the answer is still saved below.
        }
      };

      send({ type: "meta", threadId: savedThreadId, title, userMessageId: userMessage.id });
      let text = "";
      try {
        for await (const delta of stream) {
          text += delta;
          send({ type: "delta", text: delta });
        }
        const answer = finalizeAnswer(text, sources);
        if (!answer.content) throw new Error("Empty answer");

        const { data: saved, error } = await supabase
          .from("messages")
          .insert({
            thread_id: savedThreadId,
            role: "assistant",
            content: answer.content.slice(0, 20_000),
            mode,
            citations: answer.citations,
            used_general_knowledge: answer.usedGeneralKnowledge,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", savedThreadId);

        send({
          type: "done",
          message: {
            id: saved.id,
            role: "assistant",
            content: answer.content,
            mode,
            citations: answer.citations,
            used_general_knowledge: answer.usedGeneralKnowledge,
          },
        });
      } catch (error) {
        console.error("[chat] answer failed:", error);
        send({
          type: "error",
          error:
            error instanceof AiError ? error.userMessage : "La respuesta se interrumpió. Inténtalo de nuevo.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the browser.
        }
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
