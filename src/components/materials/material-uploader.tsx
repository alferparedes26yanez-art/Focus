"use client";

import { Camera, FileText, Globe, ImageIcon, LoaderCircle, MonitorPlay, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cancelUploads, createMaterials, finishUploads, type TopicChoice } from "@/lib/actions/materials";
import type { UnitView } from "@/lib/data/subjects";
import { kindForMime, MATERIAL_ACCEPT, MATERIALS_BUCKET, planMaterials, resolveMaterialMime } from "@/lib/materials/files";
import { createClient } from "@/lib/supabase/client";
import { formatBytes } from "@/lib/syllabus/files";
import { cn } from "@/lib/utils";

import { TopicSelect } from "./topic-select";
import { WebLinkDialog } from "./web-link-dialog";
import { YoutubeDialog } from "./youtube-dialog";

const PARALLEL_UPLOADS = 3;

function isPhoto(file: File) {
  const mime = resolveMaterialMime(file);
  return mime !== null && kindForMime(mime) === "images";
}

// Runs the tasks with at most `limit` at the same time.
async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export function MaterialUploader({ subjectId, units }: { subjectId: string; units: UnitView[] }) {
  const ids = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [topic, setTopic] = useState<TopicChoice>("auto");
  const [groupPhotos, setGroupPhotos] = useState(true);
  const [photosTitle, setPhotosTitle] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<"web" | "youtube" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const photoCount = files.filter(isPhoto).length;
  const plan = files.length > 0 ? planMaterials(files, { groupPhotos, photosTitle }) : null;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setError(null);
    setFiles((current) => [...current, ...Array.from(incoming)]);
  };

  const upload = async () => {
    if (!plan?.ok) return;
    setError(null);
    const created = await createMaterials(
      subjectId,
      files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
      { topic, groupPhotos, photosTitle },
    );
    if (!created.ok) {
      setError(created.error);
      return;
    }

    const supabase = createClient();
    const materials = created.data.materials;
    const total = materials.reduce((sum, material) => sum + material.uploads.length, 0);
    let done = 0;
    setUploading({ done, total });

    const failedIds = new Set<string>();
    await runPool(
      materials.flatMap((material) =>
        material.uploads.map((item) => async () => {
          if (failedIds.has(material.id)) return;
          const { error: uploadError } = await supabase.storage
            .from(MATERIALS_BUCKET)
            .upload(item.path, files[item.fileIndex], { contentType: item.mimeType, upsert: false });
          if (uploadError) failedIds.add(material.id);
          setUploading({ done: ++done, total });
        }),
      ),
      PARALLEL_UPLOADS,
    );

    const uploaded = materials.filter((material) => !failedIds.has(material.id));
    const failed = materials.filter((material) => failedIds.has(material.id));
    if (failed.length > 0) await cancelUploads(failed.map((material) => material.id));
    if (uploaded.length > 0) {
      const finished = await finishUploads(uploaded.map((material) => material.id));
      if (!finished.ok) {
        setError(finished.error);
        setUploading(null);
        return;
      }
    }

    setUploading(null);
    if (failed.length > 0) {
      setError(
        `No se pudo subir: ${failed.map((material) => `«${material.title}»`).join(", ")}. Revisa tu conexión e inténtalo de nuevo.`,
      );
      // Keep only the files that failed, to try again.
      const failedIndexes = new Set(failed.flatMap((material) => material.uploads.map((item) => item.fileIndex)));
      setFiles((current) => current.filter((_, index) => failedIndexes.has(index)));
    } else {
      setFiles([]);
      setPhotosTitle("");
    }
    if (uploaded.length > 0) {
      toast.success(
        uploaded.length === 1
          ? `«${uploaded[0].title}» se agregó. Focus lo está leyendo.`
          : `${uploaded.length} materiales agregados. Focus los está leyendo.`,
      );
    }
  };

  const busy = uploading !== null;

  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Agrega material de estudio</p>
          <p className="text-sm text-muted-foreground">
            Diapositivas, documentos y libros en PDF, Word o PowerPoint (.pptx), fotos de apuntes, páginas web y
            videos de YouTube.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
            <FileText />
            Elegir archivos
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInput.current?.click()}
            disabled={busy}
            className="sm:hidden"
          >
            <Camera />
            Tomar foto
          </Button>
          <Button type="button" variant="outline" onClick={() => setDialog("web")} disabled={busy}>
            <Globe />
            Enlace web
          </Button>
          <Button type="button" variant="outline" onClick={() => setDialog("youtube")} disabled={busy}>
            <MonitorPlay />
            YouTube
          </Button>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">o arrastra los archivos aquí · hasta 50 MB cada uno</p>
        <input
          ref={fileInput}
          type="file"
          accept={MATERIAL_ACCEPT}
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

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {files.length > 0 ? (
        <div className="grid gap-4">
          <ul className="grid gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                {isPhoto(file) ? (
                  <ImageIcon className="size-5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm break-all">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar ${file.name}`}
                  disabled={busy}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>

          {photoCount > 1 ? (
            <div className="grid gap-3 rounded-lg bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`${ids}-group`}
                  checked={groupPhotos}
                  onCheckedChange={(checked) => setGroupPhotos(checked === true)}
                  disabled={busy}
                  className="mt-0.5"
                />
                <Label htmlFor={`${ids}-group`} className="leading-snug font-normal">
                  Las {photoCount} fotos son páginas del mismo apunte (se guardan juntas, en este orden)
                </Label>
              </div>
              {groupPhotos ? (
                <div className="grid gap-1.5">
                  <Label htmlFor={`${ids}-title`}>Nombre del apunte (opcional)</Label>
                  <Input
                    id={`${ids}-title`}
                    value={photosTitle}
                    onChange={(event) => setPhotosTitle(event.target.value)}
                    placeholder="Fotos de apuntes"
                    maxLength={300}
                    disabled={busy}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={`${ids}-topic`}>¿De qué tema es?</Label>
            <TopicSelect
              id={`${ids}-topic`}
              units={units}
              value={topic}
              onChange={(value) => setTopic(value as TopicChoice)}
              includeAuto
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              Si no estás seguro, deja que la IA lo ordene según el sílabo. Puedes cambiarlo después.
            </p>
          </div>

          {plan && !plan.ok ? <p className="text-sm text-destructive">{plan.error}</p> : null}

          {uploading ? (
            <div className="grid gap-2" role="status" aria-live="polite">
              <Progress value={uploading.total ? (uploading.done / uploading.total) * 100 : 0} />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Subiendo {uploading.done} de {uploading.total}…
              </p>
            </div>
          ) : (
            <Button size="lg" onClick={upload} disabled={!plan?.ok}>
              <Upload />
              {plan?.ok && plan.materials.length > 1 ? `Subir ${plan.materials.length} materiales` : "Subir material"}
            </Button>
          )}
        </div>
      ) : null}

      <WebLinkDialog
        open={dialog === "web"}
        onOpenChange={(open) => setDialog(open ? "web" : null)}
        subjectId={subjectId}
        units={units}
      />
      <YoutubeDialog
        open={dialog === "youtube"}
        onOpenChange={(open) => setDialog(open ? "youtube" : null)}
        subjectId={subjectId}
        units={units}
      />
    </div>
  );
}
