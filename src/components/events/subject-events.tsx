"use client";

import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EVENT_KIND_LABELS } from "@/lib/constants/events";
import type { EventView, UnitView } from "@/lib/data/subjects";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { DateBlock, RelativeDay } from "./event-date";
import { EventDialog } from "./event-dialog";
import { WeightSummary } from "./weight-summary";

function unitsLabel(unitIds: string[], units: UnitView[]) {
  const numbers = units
    .map((unit, index) => (unitIds.includes(unit.id) ? index + 1 : null))
    .filter((n): n is number => n !== null);
  if (numbers.length === 0) return null;
  return numbers.length === 1 ? `Unidad ${numbers[0]}` : `Unidades ${numbers.join(", ")}`;
}

export function SubjectEvents({
  subjectId,
  events,
  units,
  today,
}: {
  subjectId: string;
  events: EventView[];
  units: UnitView[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventView | null>(null);
  const unitOptions = units.map((unit) => ({ id: unit.id, title: unit.title }));

  const openEditor = (event: EventView | null) => {
    setEditing(event);
    setOpen(true);
  };

  return (
    <div className="grid gap-4">
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin evaluaciones todavía"
          description="Agrega exámenes y entregas para verlos en el inicio, o súbelos con el sílabo."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus />
              Agregar evaluación
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WeightSummary weights={events.map((event) => event.weight)} />
            <Button variant="outline" size="sm" onClick={() => openEditor(null)}>
              <Plus />
              Agregar evaluación
            </Button>
          </div>
          <ul className="grid gap-2">
            {events.map((event) => {
              const past = event.event_date !== null && event.event_date < today;
              const covered = unitsLabel(event.unit_ids, units);
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => openEditor(event)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-xs transition hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      past && "opacity-60",
                    )}
                  >
                    <DateBlock date={event.event_date} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-medium">{event.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <Badge variant={event.kind === "exam" ? "default" : "secondary"}>
                          {EVENT_KIND_LABELS[event.kind]}
                        </Badge>
                        {event.event_time ? <span>{formatTime(event.event_time)}</span> : null}
                        {covered ? <span>{covered}</span> : null}
                        {event.notes && !event.event_date ? (
                          <span className="truncate">{event.notes}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {event.weight !== null ? (
                        <span className="text-sm font-semibold tabular-nums">{event.weight} %</span>
                      ) : null}
                      {event.event_date ? <RelativeDay date={event.event_date} today={today} /> : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <EventDialog
        open={open}
        onOpenChange={setOpen}
        subjectId={subjectId}
        event={editing}
        units={unitOptions}
      />
    </div>
  );
}
