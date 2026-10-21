"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createEvent, deleteEvent, updateEvent } from "@/lib/actions/events";
import type { EventView } from "@/lib/data/subjects";

import { EMPTY_EVENT, EventFields, parseWeight, type EventFormValue } from "./event-fields";

function toFormValue(event: EventView): EventFormValue {
  return {
    kind: event.kind,
    title: event.title,
    event_date: event.event_date ?? "",
    event_time: event.event_time ?? "",
    weight: event.weight === null ? "" : String(event.weight),
    notes: event.notes ?? "",
    unit_ids: event.unit_ids,
  };
}

export function EventDialog({
  open,
  onOpenChange,
  subjectId,
  event,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  event: EventView | null;
  units: { id: string; title: string }[];
}) {
  const [value, setValue] = useState<EventFormValue>(event ? toFormValue(event) : EMPTY_EVENT);
  const [errors, setErrors] = useState<Record<string, string>>();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fresh values every time it opens (for a new or a different evaluation).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? (event?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setValue(event ? toFormValue(event) : EMPTY_EVENT);
      setErrors(undefined);
      setConfirmDelete(false);
    }
  }

  const save = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    const weight = parseWeight(value.weight);
    if (value.weight.trim() !== "" && weight === null) {
      setErrors({ weight: "Escribe un número" });
      return;
    }
    const input = {
      kind: value.kind,
      title: value.title,
      event_date: value.event_date || null,
      event_time: value.event_time || null,
      weight,
      notes: value.notes,
      unit_ids: value.unit_ids.filter((id) => units.some((unit) => unit.id === id)),
    };
    startTransition(async () => {
      const result = event ? await updateEvent(event.id, input) : await createEvent(subjectId, input);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(event ? "Evaluación actualizada" : "Evaluación agregada");
      onOpenChange(false);
    });
  };

  const remove = () => {
    if (!event) return;
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Evaluación borrada");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={save} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{event ? "Editar evaluación" : "Nueva evaluación"}</DialogTitle>
            <DialogDescription>Exámenes, entregas, proyectos y otras fechas de la materia.</DialogDescription>
          </DialogHeader>
          <EventFields idPrefix="event" value={value} onChange={setValue} units={units} errors={errors} />
          <DialogFooter className="sm:justify-between">
            {event ? (
              confirmDelete ? (
                <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
                  <Trash2 />
                  Confirmar borrado
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending}>
                  <Trash2 />
                  Borrar
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || value.title.trim() === ""}>
                {pending ? <LoaderCircle className="animate-spin" /> : null}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
