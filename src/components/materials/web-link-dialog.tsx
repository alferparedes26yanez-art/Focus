"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
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
import { addWebMaterial, type TopicChoice } from "@/lib/actions/materials";
import type { UnitView } from "@/lib/data/subjects";

import { TopicSelect } from "./topic-select";

export function WebLinkDialog({
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
  const [topic, setTopic] = useState<TopicChoice>("auto");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await addWebMaterial(subjectId, url, topic);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Enlace agregado. Focus lo está leyendo.");
      setUrl("");
      setError(null);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Agregar una página web</DialogTitle>
            <DialogDescription>
              Focus guarda el texto del artículo para buscarlo y citarlo. Funciona con páginas públicas (no con las
              que piden iniciar sesión).
            </DialogDescription>
          </DialogHeader>
          <FormField label="Enlace" htmlFor={`${ids}-url`} error={error}>
            <Input
              id={`${ids}-url`}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              maxLength={2000}
              autoFocus
            />
          </FormField>
          <FormField label="¿De qué tema es?" htmlFor={`${ids}-topic`}>
            <TopicSelect
              id={`${ids}-topic`}
              units={units}
              value={topic}
              onChange={(value) => setTopic(value as TopicChoice)}
              includeAuto
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !url.trim()}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
