"use client";

import { Camera, CircleCheck, FileText, ImageIcon, LoaderCircle, RotateCw, Sparkles, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createSyllabusImport } from "@/lib/actions/syllabus";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPT_ATTRIBUTE,
  formatBytes,
  isImageMime,
  resolveMimeType,
  SYLLABUS_BUCKET,
  validateSyllabusFiles,
} from "@/lib/syllabus/files";
import { cn } from "@/lib/utils";

type Phase =
  | { name: "select" }
  | { name: "uploading" }
  | { name: "reading"; importId: string }
  | { name: "error"; message: string; importId?: string };

export async function requestExtraction(importId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/syllabus/${importId}/extract`, { method: "POST" });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (body?.error) return { ok: false, error: body.error };
    return {
      ok: false,
      error:
        response.status === 504
          ? "La lectura tardó demasiado. Inténtalo de nuevo; si se repite, prueba con un PDF más liviano."
          : "No pudimos leer el sílabo. Inténtalo de nuevo.",
    };
  } catch {
    return { ok: false, error: "Se perdió la conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}

export function SyllabusUploader({ subjectId, onboarding = false }: { subjectId: string; onboarding?: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "select" });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const validation = files.length > 0 ? validateSyllabusFiles(files) : null;
  const busy = phase.name === "uploading" || phase.name === "reading";

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);
    setPhase({ name: "select" });
    setFiles((current) => {
      // Photos accumulate (one page per photo); a document replaces everything.
      const onlyImages = list.every((file) => isImageMime(resolveMimeType(file) ?? ""));
      const currentImages = current.every((file) => isImageMime(resolveMimeType(file) ?? ""));
      return onlyImages && currentImages ? [...current, ...list] : list;
    });
  };

  const reviewUrl = (importId: string) =>
    `/subjects/${subjectId}/syllabus/${importId}${onboarding ? "?onboarding=1" : ""}`;

  const read = async (importId: string) => {
    setPhase({ name: "reading", importId });
    const result = await requestExtraction(importId);
    if (!result.ok) {
      setPhase({ name: "error", message: result.error, importId });
      return;
    }
    router.push(reviewUrl(importId));
  };

  const start = async () => {
    if (!validation?.ok) return;
    setPhase({ name: "uploading" });

    const created = await createSyllabusImport(
      subjectId,
      files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
    );
    if (!created.ok) {
      setPhase({ name: "error", message: created.error });
      return;
    }

    const supabase = createClient();
    const results = await Promise.all(
      created.data.uploads.map((upload, index) =>
        supabase.storage
          .from(SYLLABUS_BUCKET)
          .upload(upload.path, files[index], { contentType: upload.mimeType, upsert: false }),
      ),
    );
    if (results.some((result) => result.error)) {
      setPhase({
        name: "error",
        message: "No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.",
      });
      return;
    }

    await read(created.data.importId);
  };

  if (busy) {
    return <ExtractionProgress phase={phase.name} />;
  }

  return (
    <div className="grid gap-4">
      {phase.name === "error" ? (
        <Alert variant="destructive">
          <AlertDescription className="grid gap-3">
            <p>{phase.message}</p>
            {phase.importId ? (
              <Button variant="outline" size="sm" className="w-fit" onClick={() => read(phase.importId!)}>
                <RotateCw />
                Reintentar lectura
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Sube el sílabo de la materia</p>
          <p className="text-sm text-muted-foreground">
            PDF, Word (.docx) o fotos de cada página. Máximo 10 MB por archivo.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => fileInput.current?.click()}>
            <FileText />
            Elegir archivo
          </Button>
          <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()} className="sm:hidden">
            <Camera />
            Tomar foto
          </Button>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">o arrástralo aquí</p>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {files.length > 0 ? (
        <div className="grid gap-3">
          <ul className="grid gap-2">
            {files.map((file, index) => {
              const image = isImageMime(resolveMimeType(file) ?? "");
              return (
                <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                  {image ? (
                    <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{image && files.length > 1 ? `Página ${index + 1}: ${file.name}` : file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </li>
              );
            })}
          </ul>
          {validation && !validation.ok ? <p className="text-sm text-destructive">{validation.error}</p> : null}
          {validation?.ok && files.every((file) => isImageMime(resolveMimeType(file) ?? "")) ? (
            <p className="text-xs text-muted-foreground">
              ¿El sílabo tiene más páginas? Agrega una foto por página, en orden.
            </p>
          ) : null}
          <Button size="lg" onClick={start} disabled={!validation?.ok}>
            <Sparkles />
            Organizar con IA
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const READING_MESSAGES = [
  "Leyendo el sílabo…",
  "Detectando unidades y temas…",
  "Buscando fechas de exámenes y entregas…",
  "Revisando ponderaciones y bibliografía…",
];

function ExtractionProgress({ phase }: { phase: "uploading" | "reading" }) {
  const reading = phase === "reading";
  return (
    <div className="grid gap-5 rounded-2xl border bg-card p-6" role="status" aria-live="polite">
      <ol className="grid gap-3 text-sm">
        <li className="flex items-center gap-3">
          {reading ? (
            <CircleCheck className="size-5 text-success" />
          ) : (
            <LoaderCircle className="size-5 animate-spin text-primary" />
          )}
          Subir archivo
        </li>
        <li className={cn("flex items-center gap-3", !reading && "text-muted-foreground")}>
          {reading ? (
            <LoaderCircle className="size-5 animate-spin text-primary" />
          ) : (
            <span className="size-5 rounded-full border-2" />
          )}
          Leer y organizar con IA
        </li>
        <li className="flex items-center gap-3 text-muted-foreground">
          <span className="size-5 rounded-full border-2" />
          Revisar y guardar
        </li>
      </ol>
      {reading ? (
        <div className="grid gap-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
            <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-[indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
          <RotatingMessage messages={READING_MESSAGES} />
          <p className="text-xs text-muted-foreground">Suele tardar entre 10 y 40 segundos. No cierres esta página.</p>
        </div>
      ) : null}
    </div>
  );
}

function RotatingMessage({ messages }: { messages: string[] }) {
  return (
    <p className="relative h-5 overflow-hidden text-sm text-muted-foreground">
      {messages.map((message, index) => (
        <span
          key={message}
          className={cn(
            "absolute inset-0 opacity-0 motion-safe:animate-[message-cycle_var(--cycle)_linear_infinite]",
            index === 0 && "motion-reduce:opacity-100",
          )}
          style={
            {
              "--cycle": `${messages.length * 6}s`,
              animationDelay: `${index * 6}s`,
            } as React.CSSProperties
          }
        >
          {message}
        </span>
      ))}
    </p>
  );
}
