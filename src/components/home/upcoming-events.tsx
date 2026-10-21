import { CalendarCheck } from "lucide-react";
import Link from "next/link";

import { DateBlock, RelativeDay } from "@/components/events/event-date";
import { Badge } from "@/components/ui/badge";
import { EVENT_KIND_LABELS } from "@/lib/constants/events";
import { getSubjectColor } from "@/lib/constants/subject-colors";
import type { UpcomingEvent } from "@/lib/data/subjects";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function UpcomingEvents({ events, today }: { events: UpcomingEvent[]; today: string }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <CalendarCheck className="size-5 shrink-0" />
        No tienes exámenes ni entregas próximas. Cuando subas el sílabo de tus materias, sus fechas aparecerán aquí.
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/subjects/${event.subject.id}?tab=evaluaciones`}
            className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs transition hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <DateBlock date={event.event_date} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-medium">{event.title}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", getSubjectColor(event.subject.color).bar)}
                />
                <span className="truncate">{event.subject.name}</span>
                {event.event_time ? <span>· {formatTime(event.event_time)}</span> : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={event.kind === "exam" ? "default" : "secondary"}>{EVENT_KIND_LABELS[event.kind]}</Badge>
              <RelativeDay date={event.event_date} today={today} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
