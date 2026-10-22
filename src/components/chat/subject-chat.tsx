"use client";

import { LoaderCircle, MessageCircle, Plus, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { deleteChatThread, loadChatThread } from "@/lib/actions/chat";
import type { ChatMode } from "@/lib/ai/prompts";
import { CHAT_MODES, type ChatMessageView, type ChatStreamEvent, type ChatThreadView } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

import { ChatMessage } from "./chat-message";

type SendResult = { ok: true } | { ok: false; error: string; keepQuestion: boolean };

// Reads the NDJSON answer of /api/chat line by line.
async function streamAnswer(
  body: { subjectId: string; threadId: string | null; message: string; mode: ChatMode },
  onEvent: (event: ChatStreamEvent) => void,
): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "Se perdió la conexión. Revisa tu internet e inténtalo de nuevo.", keepQuestion: true };
  }
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: data?.error ?? "No se pudo responder. Inténtalo de nuevo.", keepQuestion: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as ChatStreamEvent;
        if (event.type === "done" || event.type === "error") finished = true;
        onEvent(event);
      }
      if (done) break;
    }
  } catch {
    // Connection lost mid-answer.
  }
  if (!finished) {
    return { ok: false, error: "La respuesta se interrumpió. Inténtalo de nuevo.", keepQuestion: false };
  }
  return { ok: true };
}

export function SubjectChat({
  subjectId,
  threads: initialThreads,
  hasMaterial,
  suggestions,
}: {
  subjectId: string;
  threads: ChatThreadView[];
  hasMaterial: boolean;
  suggestions: string[];
}) {
  const ids = useId();
  const [threads, setThreads] = useState(initialThreads);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<ChatMode>("simple");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingThread, startLoading] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const busy = sending || loadingThread;

  useEffect(() => {
    if (draft !== null || messages.length > 0) endRef.current?.scrollIntoView({ block: "end" });
  }, [draft, messages.length]);

  const openThread = (id: string) => {
    setError(null);
    if (!id) {
      setThreadId(null);
      setMessages([]);
      return;
    }
    startLoading(async () => {
      const result = await loadChatThread(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setThreadId(id);
      setMessages(result.data.messages);
    });
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setSending(true);
    setQuestion("");
    const tempId = `temp-${crypto.randomUUID()}`;
    setMessages((current) => [
      ...current,
      { id: tempId, role: "user", content: message, mode, citations: [], used_general_knowledge: false },
    ]);
    setDraft("");

    const result = await streamAnswer({ subjectId, threadId, message, mode }, (event) => {
      if (event.type === "meta") {
        setThreadId(event.threadId);
        setMessages((current) =>
          current.map((item) => (item.id === tempId ? { ...item, id: event.userMessageId } : item)),
        );
        setThreads((current) =>
          current.some((thread) => thread.id === event.threadId)
            ? current
            : [{ id: event.threadId, title: event.title, updated_at: new Date().toISOString() }, ...current],
        );
      } else if (event.type === "delta") {
        setDraft((current) => (current ?? "") + event.text);
      } else if (event.type === "done") {
        setDraft(null);
        setMessages((current) => [...current, event.message]);
      } else {
        setDraft(null);
        setError(event.error);
      }
    });

    setDraft(null);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      if (result.keepQuestion) {
        // Nothing was saved: take the question back to the box.
        setMessages((current) => current.filter((item) => item.id !== tempId));
        setQuestion(message);
      }
    }
  };

  const removeThread = () =>
    startDeleting(async () => {
      if (!threadId) return;
      const result = await deleteChatThread(threadId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setThreads((current) => current.filter((thread) => thread.id !== threadId));
      setThreadId(null);
      setMessages([]);
      setConfirmDelete(false);
    });

  const lastUserQuestion = [...messages].reverse().find((item) => item.role === "user")?.content;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Conversación"
          className="min-w-0 flex-1 sm:max-w-sm"
          value={threadId ?? ""}
          onChange={(event) => openThread(event.target.value)}
          disabled={busy}
        >
          <option value="">Nueva conversación</option>
          {threads.map((thread) => (
            <option key={thread.id} value={thread.id}>
              {thread.title}
            </option>
          ))}
        </NativeSelect>
        {threadId ? (
          <>
            <Button variant="outline" size="icon" aria-label="Nueva conversación" onClick={() => openThread("")} disabled={busy}>
              <Plus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Borrar conversación"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 />
            </Button>
          </>
        ) : null}
      </div>

      <div className="grid min-h-64 content-start gap-4" aria-live="polite" aria-busy={sending}>
        {loadingThread ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Abriendo conversación…
          </div>
        ) : messages.length === 0 && draft === null ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">Pregúntale a tu material</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                {hasMaterial
                  ? "Las respuestas citan el documento y la página (o el minuto) de donde salen. Toca un número para verlo."
                  : "Todavía no hay material leído. Sube tus documentos en la pestaña Material para que las respuestas citen tus fuentes."}
              </p>
            </div>
            {hasMaterial && suggestions.length > 0 ? (
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <Button key={suggestion} variant="outline" size="sm" onClick={() => send(suggestion)}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} subjectId={subjectId} />
            ))}
            {draft !== null ? (
              draft ? (
                <ChatMessage
                  message={{ role: "assistant", content: draft, citations: [], used_general_knowledge: false }}
                  subjectId={subjectId}
                  streaming
                />
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Buscando en tu material…
                </p>
              )
            ) : null}
          </>
        )}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="grid gap-2">
              <p>{error}</p>
              {!question && lastUserQuestion && !sending ? (
                <Button variant="outline" size="sm" className="w-fit" onClick={() => send(lastUserQuestion)}>
                  Volver a preguntar
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(question);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 grid gap-2 rounded-2xl border bg-background p-2 shadow-sm md:bottom-4"
      >
        <div role="radiogroup" aria-label="Tipo de explicación" className="flex gap-1 overflow-x-auto">
          {CHAT_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              title={option.hint}
              onClick={() => setMode(option.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                mode === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label htmlFor={`${ids}-question`} className="sr-only">
            Tu pregunta
          </label>
          <Textarea
            id={`${ids}-question`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send(question);
              }
            }}
            placeholder="Pregunta sobre esta materia…"
            rows={1}
            maxLength={4000}
            className="max-h-40 min-h-10 resize-none border-0 shadow-none field-sizing-content focus-visible:ring-0 dark:bg-transparent"
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={busy || !question.trim()}>
            {sending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </div>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => !deleting && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription>Se borran sus preguntas y respuestas. Tu material no cambia.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={removeThread} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              Borrar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
