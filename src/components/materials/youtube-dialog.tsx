"use client";

import { Clock, LoaderCircle, Wallet } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addYoutubeMaterial, previewYoutube, type TopicChoice, type YoutubePreview } from "@/lib/actions/materials";
import type { UnitView } from "@/lib/data/subjects";
import { formatDuration } from "@/lib/materials/extract/youtube";
import { formatEstimatedUsd } from "@/lib/format";

import { TopicSelect } from "./topic-select";

// Two steps: paste the link, then confirm after seeing the estimated cost.
export function YoutubeDialog({
  open,
  onOpenChange,
  subjectId,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  units: UnitView[];
}) {
  const ids = useId();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<YoutubePreview | null>(null);
  const [minutes, setMinutes] = useState("");
  const [topic, setTopic] = useState<TopicChoice>("auto");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setUrl("");
    setPreview(null);
    setMinutes("");
    setError(null);
  };

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const durationSeconds = preview?.durationSeconds ?? (Number(minutes) > 0 ? Math.round(Number(minutes) * 60) : null);
  const cost = preview && durationSeconds ? (preview.costPerMinuteUsd * durationSeconds) / 60 : null;
  const tooLong = preview && durationSeconds ? durationSeconds > preview.maxSeconds : false;
  const overBudget = preview && cost !== null ? cost > preview.remainingBudgetUsd : false;

  const check = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await previewYoutube(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setPreview(result.data);
    });
  };

  const confirm = () => {
    if (!preview || !durationSeconds) return;
    startTransition(async () => {
      const result = await addYoutubeMaterial(subjectId, {
        videoId: preview.videoId,
        title: preview.title,
        durationSeconds,
        topic,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Video agregado. Focus lo está transcribiendo.");
      reset();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar un video de YouTube</DialogTitle>
          <DialogDescription>
            La IA transcribe el video para que puedas buscarlo y saltar al minuto exacto. Antes te mostramos cuánto
            cuesta.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <form onSubmit={check} className="grid gap-4">
            <FormField label="Enlace del video" htmlFor={`${ids}-url`} error={error}>
              <Input
                id={`${ids}-url`}
                type="url"
                inputMode="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                autoFocus
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !url.trim()}>
                {pending ? <LoaderCircle className="animate-spin" /> : null}
                Continuar
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1 rounded-lg border p-3">
              <p className="font-medium">{preview.title ?? "Video de YouTube"}</p>
              {preview.durationSeconds ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  {formatDuration(preview.durationSeconds)}
                </p>
              ) : null}
            </div>

            {!preview.durationSeconds ? (
              <FormField
                label="¿Cuántos minutos dura?"
                htmlFor={`${ids}-minutes`}
                hint="No pudimos leer la duración. Escríbela para calcular el costo."
              >
                <Input
                  id={`${ids}-minutes`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={preview.maxSeconds / 60}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  className="w-32"
                />
              </FormField>
            ) : null}

            {tooLong ? (
              <Alert variant="destructive">
                <AlertDescription>
                  El video dura más de {preview.maxSeconds / 60} minutos. Por ahora Focus transcribe videos de hasta
                  una hora.
                </AlertDescription>
              </Alert>
            ) : cost !== null ? (
              <Alert variant={overBudget ? "destructive" : "default"}>
                <Wallet />
                <AlertDescription className={overBudget ? undefined : "text-foreground"}>
                  <p>
                    Costo estimado: <strong>{formatEstimatedUsd(cost)}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    {overBudget
                      ? `Supera lo que queda del presupuesto de IA del mes (${formatEstimatedUsd(preview.remainingBudgetUsd)}).`
                      : `Te quedan ${formatEstimatedUsd(preview.remainingBudgetUsd)} del presupuesto de IA del mes.`}
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField label="¿De qué tema es?" htmlFor={`${ids}-topic`}>
              <TopicSelect
                id={`${ids}-topic`}
                units={units}
                value={topic}
                onChange={(value) => setTopic(value as TopicChoice)}
                includeAuto
              />
            </FormField>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={pending}>
                Atrás
              </Button>
              <Button onClick={confirm} disabled={pending || !durationSeconds || tooLong || overBudget}>
                {pending ? <LoaderCircle className="animate-spin" /> : null}
                Transcribir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
