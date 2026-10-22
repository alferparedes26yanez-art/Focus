"use client";

import { BookOpen, Lightbulb } from "lucide-react";
import Link from "next/link";

import { locationLabel, type Citation } from "@/lib/chat/citations";
import type { ChatMessageView } from "@/lib/chat/types";
import { materialHref } from "@/lib/materials/types";

import { ChatMarkdown } from "./chat-markdown";

function Sources({ citations, subjectId }: { citations: Citation[]; subjectId: string }) {
  if (citations.length === 0) return null;
  return (
    <div className="grid gap-1.5 border-t pt-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookOpen className="size-3.5" />
        Fuentes de tu material
      </p>
      <ol className="grid gap-1">
        {[...citations]
          .sort((a, b) => a.n - b.n)
          .map((citation) => (
            <li key={citation.n}>
              <Link
                href={materialHref(subjectId, citation.material_id, {
                  page: citation.page,
                  seconds: citation.start_seconds,
                  chunkId: citation.chunk_id,
                })}
                className="group flex items-baseline gap-2 text-xs"
              >
                <span className="inline-grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-primary/12 px-1 font-semibold text-primary tabular-nums">
                  {citation.n}
                </span>
                <span className="min-w-0 group-hover:underline">
                  <span className="font-medium">{citation.title}</span>
                  {locationLabel(citation) ? (
                    <span className="text-muted-foreground"> · {locationLabel(citation)}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
      </ol>
    </div>
  );
}

export function ChatMessage({
  message,
  subjectId,
  streaming = false,
}: {
  message: Pick<ChatMessageView, "role" | "content" | "citations" | "used_general_knowledge">;
  subjectId: string;
  streaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="grid max-w-[95%] gap-3 rounded-2xl rounded-bl-md border bg-card px-4 py-3">
      <ChatMarkdown content={message.content} citations={message.citations} subjectId={subjectId} />
      {streaming ? <span className="h-4 w-2 animate-pulse rounded-sm bg-primary/60" aria-hidden /> : null}
      {!streaming && message.used_general_knowledge ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lightbulb className="mt-px size-3.5 shrink-0" />
          Parte de esta respuesta usa conocimiento general, no tu material. Verifícala con tus apuntes.
        </p>
      ) : null}
      {!streaming ? <Sources citations={message.citations} subjectId={subjectId} /> : null}
    </div>
  );
}
