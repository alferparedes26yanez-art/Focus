import "server-only";

import { cache } from "react";

import { requireUser } from "@/lib/auth";
import type { EventKind } from "@/lib/constants/events";
import { DEFAULT_TIME_ZONE, todayIn } from "@/lib/dates";
import { bibliographyItemSchema, type BibliographyItem } from "@/lib/syllabus/schemas";

export type TopicView = {
  id: string;
  title: string;
  description: string | null;
};

export type UnitView = {
  id: string;
  title: string;
  topics: TopicView[];
};

export type EventView = {
  id: string;
  kind: EventKind;
  title: string;
  event_date: string | null;
  event_time: string | null;
  weight: number | null;
  notes: string | null;
  unit_ids: string[];
};

export type SubjectSummary = {
  id: string;
  name: string;
  color: string;
  icon: string;
  teacher_name: string | null;
};

export type UpcomingEvent = {
  id: string;
  kind: EventKind;
  title: string;
  event_date: string;
  event_time: string | null;
  weight: number | null;
  subject: SubjectSummary;
};

export const getProfile = cache(async () => {
  const { supabase, userId, email } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, timezone, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  const timezone = data?.timezone ?? DEFAULT_TIME_ZONE;
  return {
    userId,
    email,
    fullName: data?.full_name ?? null,
    timezone,
    onboardingCompleted: Boolean(data?.onboarding_completed_at),
    today: todayIn(timezone),
  };
});

export async function getSubjectsOverview() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, color, icon, teacher_name, units(id, topics(count))")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return data.map((subject) => ({
    id: subject.id,
    name: subject.name,
    color: subject.color,
    icon: subject.icon,
    teacher_name: subject.teacher_name,
    unitCount: subject.units.length,
    topicCount: subject.units.reduce((sum, unit) => sum + (unit.topics[0]?.count ?? 0), 0),
  }));
}

export async function getUpcomingEvents(today: string, limit: number): Promise<UpcomingEvent[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, kind, title, event_date, event_time, weight, subject:subjects(id, name, color, icon, teacher_name)",
    )
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  return data
    .filter((event) => event.event_date !== null && event.subject !== null)
    .map((event) => ({
      id: event.id,
      kind: event.kind as EventKind,
      title: event.title,
      event_date: event.event_date as string,
      event_time: event.event_time,
      weight: event.weight,
      subject: event.subject as SubjectSummary,
    }));
}

function sortEvents(events: EventView[]): EventView[] {
  return [...events].sort((a, b) => {
    if (a.event_date === b.event_date) return (a.event_time ?? "").localeCompare(b.event_time ?? "");
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return a.event_date.localeCompare(b.event_date);
  });
}

function parseBibliography(value: unknown): BibliographyItem[] {
  const parsed = bibliographyItemSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function getSubjectDetail(subjectId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("subjects")
    .select(
      `id, name, color, icon, teacher_name, teacher_email, teacher_notes, bibliography,
       units(id, title, position, topics(id, title, description, position)),
       events(id, kind, title, event_date, event_time, weight, notes, event_units(unit_id)),
       syllabus_imports(id, status, created_at)`,
    )
    .eq("id", subjectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const units: UnitView[] = [...data.units]
    .sort((a, b) => a.position - b.position)
    .map((unit) => ({
      id: unit.id,
      title: unit.title,
      topics: [...unit.topics]
        .sort((a, b) => a.position - b.position)
        .map((topic) => ({ id: topic.id, title: topic.title, description: topic.description })),
    }));

  const events = sortEvents(
    data.events.map((event) => ({
      id: event.id,
      kind: event.kind as EventKind,
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time ? event.event_time.slice(0, 5) : null,
      weight: event.weight,
      notes: event.notes,
      unit_ids: event.event_units.map((link) => link.unit_id),
    })),
  );

  // Most recent unfinished import, to resume it instead of starting over.
  const pendingImport =
    [...data.syllabus_imports]
      .filter((item) => item.status !== "applied")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    icon: data.icon,
    teacher_name: data.teacher_name,
    teacher_email: data.teacher_email,
    teacher_notes: data.teacher_notes,
    bibliography: parseBibliography(data.bibliography),
    units,
    events,
    pendingImport,
    isEmpty: units.length === 0 && events.length === 0,
  };
}

export type SubjectDetail = NonNullable<Awaited<ReturnType<typeof getSubjectDetail>>>;
