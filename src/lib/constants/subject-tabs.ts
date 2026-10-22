// Tabs of a subject page, also used in links (?tab=material). Kept out of the
// "use client" tabs component so server code can read the list too.
export const SUBJECT_TABS = ["temas", "material", "chat", "evaluaciones"] as const;
export type SubjectTab = (typeof SUBJECT_TABS)[number];

export function parseSubjectTab(value: unknown): SubjectTab {
  return SUBJECT_TABS.find((tab) => tab === value) ?? "temas";
}
