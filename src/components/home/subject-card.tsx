import Link from "next/link";

import { RelativeDay } from "@/components/events/event-date";
import { SubjectIcon } from "@/components/subjects/subject-icon";
import { EVENT_KIND_LABELS } from "@/lib/constants/events";
import { getSubjectColor } from "@/lib/constants/subject-colors";
import type { UpcomingEvent } from "@/lib/data/subjects";
import { cn } from "@/lib/utils";

export function SubjectCard({
  subject,
  nextEvent,
  today,
}: {
  subject: {
    id: string;
    name: string;
    color: string;
    icon: string;
    teacher_name: string | null;
    unitCount: number;
    topicCount: number;
  };
  nextEvent: UpcomingEvent | null;
  today: string;
}) {
  return (
    <Link
      href={`/subjects/${subject.id}`}
      className="group relative flex min-h-32 flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", getSubjectColor(subject.color).bar)} />
      <div className="flex items-start gap-3">
        <SubjectIcon color={subject.color} icon={subject.icon} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug">{subject.name}</p>
          <p className="truncate text-xs text-muted-foreground">{subject.teacher_name ?? "Sin docente"}</p>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {subject.unitCount === 0
            ? "Sin sílabo todavía"
            : `${subject.unitCount} ${subject.unitCount === 1 ? "unidad" : "unidades"} · ${subject.topicCount} temas`}
        </span>
        {nextEvent ? (
          <span className="flex flex-col items-end text-right">
            <span className="max-w-32 truncate">{EVENT_KIND_LABELS[nextEvent.kind]}</span>
            <RelativeDay date={nextEvent.event_date} today={today} />
          </span>
        ) : null}
      </div>
    </Link>
  );
}
