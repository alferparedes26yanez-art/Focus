export const EVENT_KINDS = ["exam", "assignment", "project", "quiz", "presentation", "other"] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  exam: "Examen",
  assignment: "Entrega",
  project: "Proyecto",
  quiz: "Lección",
  presentation: "Exposición",
  other: "Otro",
};

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}
