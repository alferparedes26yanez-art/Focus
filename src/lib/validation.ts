import { z } from "zod";

import { EVENT_KINDS } from "@/lib/constants/events";
import { SUBJECT_COLOR_KEYS } from "@/lib/constants/subject-colors";
import { SUBJECT_ICON_KEYS } from "@/lib/constants/subject-icons";
import { isRealDate } from "@/lib/syllabus/schemas";

// Input schemas shared by forms (client) and Server Actions (server).

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const subjectInputSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la materia").max(80, "Máximo 80 caracteres"),
  color: z.enum(SUBJECT_COLOR_KEYS as [string, ...string[]]),
  icon: z.enum(SUBJECT_ICON_KEYS as [string, ...string[]]),
  teacher_name: optionalText(120),
  teacher_email: optionalText(200).refine(
    (value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Correo no válido",
  ),
  teacher_notes: optionalText(1000),
});

export type SubjectInput = z.input<typeof subjectInputSchema>;

export const titleSchema = (max: number) =>
  z.string().trim().min(1, "No puede quedar vacío").max(max, `Máximo ${max} caracteres`);

export const eventInputSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  title: titleSchema(200),
  event_date: z
    .string()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isRealDate(value), "Fecha no válida"),
  event_time: z
    .string()
    .nullable()
    .transform((value) => (value ? value.slice(0, 5) : null))
    .refine((value) => value === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Hora no válida"),
  weight: z.number().min(0, "Entre 0 y 100").max(100, "Entre 0 y 100").nullable(),
  notes: optionalText(1000),
  unit_ids: z.array(z.uuid()).max(100),
});

export type EventInput = z.input<typeof eventInputSchema>;

export const passwordSchema = z
  .string()
  .min(8, "Usa al menos 8 caracteres")
  .max(72, "Máximo 72 caracteres");

export const profileInputSchema = z.object({
  full_name: optionalText(120),
  timezone: z.string().min(1).max(64),
});
