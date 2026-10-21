import { z } from "zod";

import { EVENT_KINDS } from "@/lib/constants/events";

// What the AI must return. Descriptions are sent to the model as part of the
// JSON schema, so they are written for it.
export const syllabusAiOutputSchema = z.object({
  is_syllabus: z
    .boolean()
    .describe("false when the document is clearly not a course syllabus or program"),
  course_term: z
    .string()
    .nullable()
    .describe("Academic period exactly as written, e.g. '2026-2' or 'Septiembre 2026 - Enero 2027'"),
  teacher: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    notes: z
      .string()
      .nullable()
      .describe("Office hours, office, phone or other contact details, as written"),
  }),
  units: z.array(
    z.object({
      title: z
        .string()
        .describe("Unit title including its number when the syllabus numbers it, e.g. 'Unidad 1: Límites'"),
      topics: z.array(
        z.object({
          title: z.string(),
          details: z
            .string()
            .nullable()
            .describe("Subtopics listed under this topic, joined with '; '. null if none"),
        }),
      ),
    }),
  ),
  events: z.array(
    z.object({
      kind: z.enum(EVENT_KINDS),
      title: z.string(),
      date: z
        .string()
        .nullable()
        .describe("YYYY-MM-DD, only when the document gives the day and the month"),
      time: z.string().nullable().describe("HH:MM in 24h format, only when stated"),
      date_text: z
        .string()
        .nullable()
        .describe("The date or timing exactly as written in the document, e.g. 'Semana 8'"),
      weight_percent: z
        .number()
        .nullable()
        .describe("Share of the final grade from 0 to 100, null when not stated"),
      unit_numbers: z
        .array(z.number().int().min(1).max(100))
        .describe("1-based positions in `units` of the units this evaluation covers; empty if not stated"),
    }),
  ),
  bibliography: z.array(
    z.object({
      citation: z.string(),
      kind: z.enum(["basic", "complementary"]).nullable(),
      url: z.string().nullable(),
    }),
  ),
  warnings: z
    .array(z.string())
    .describe("Short notes in Spanish about ambiguous items the student should double-check"),
});

export type SyllabusAiOutput = z.infer<typeof syllabusAiOutputSchema>;

// ---------------------------------------------------------------------------
// Normalized draft stored in syllabus_imports.extraction and edited in the
// review screen; also the payload sent to apply_syllabus_import.
// ---------------------------------------------------------------------------

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((value) => isRealDate(value), "Fecha inválida");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");

export const bibliographyItemSchema = z.object({
  citation: z.string().trim().min(1).max(1000),
  kind: z.enum(["basic", "complementary"]).nullable(),
  url: z.string().max(1000).nullable(),
});

export type BibliographyItem = z.infer<typeof bibliographyItemSchema>;

export const draftTopicSchema = z.object({
  title: z.string().trim().min(1, "Escribe el nombre del tema").max(300),
  description: z.string().trim().max(2000).nullable(),
});

export const draftUnitSchema = z.object({
  title: z.string().trim().min(1, "Escribe el nombre de la unidad").max(200),
  topics: z.array(draftTopicSchema).max(200),
});

export const draftEventSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  title: z.string().trim().min(1, "Escribe el nombre de la evaluación").max(200),
  event_date: isoDate.nullable(),
  event_time: time.nullable(),
  weight: z.number().min(0).max(100).nullable(),
  notes: z.string().trim().max(1000).nullable(),
  unit_indexes: z.array(z.number().int().min(0)).max(100),
});

export const draftTeacherSchema = z.object({
  name: z.string().trim().max(120).nullable(),
  email: z.string().trim().max(200).nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

export const syllabusApplySchema = z.object({
  units: z.array(draftUnitSchema).max(60),
  events: z.array(draftEventSchema).max(100),
  teacher: draftTeacherSchema,
  bibliography: z.array(bibliographyItemSchema).max(100),
});

export type SyllabusApplyPayload = z.infer<typeof syllabusApplySchema>;

export const syllabusDraftSchema = syllabusApplySchema.extend({
  course_term: z.string().max(200).nullable(),
  warnings: z.array(z.string().max(500)).max(20),
});

export type SyllabusDraft = z.infer<typeof syllabusDraftSchema>;
export type DraftUnit = z.infer<typeof draftUnitSchema>;
export type DraftEvent = z.infer<typeof draftEventSchema>;

export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
