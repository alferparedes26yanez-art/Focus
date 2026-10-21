"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUBJECT_COLORS, SUBJECT_COLOR_KEYS, type SubjectColor } from "@/lib/constants/subject-colors";
import { SUBJECT_ICONS } from "@/lib/constants/subject-icons";
import { cn } from "@/lib/utils";
import type { SubjectInput } from "@/lib/validation";

export type SubjectFormValue = {
  name: string;
  color: string;
  icon: string;
  teacher_name: string;
  teacher_email: string;
  teacher_notes: string;
};

export const EMPTY_SUBJECT: SubjectFormValue = {
  name: "",
  color: "indigo",
  icon: "book-open",
  teacher_name: "",
  teacher_email: "",
  teacher_notes: "",
};

export function toSubjectInput(value: SubjectFormValue): SubjectInput {
  return {
    name: value.name,
    color: value.color,
    icon: value.icon,
    teacher_name: value.teacher_name,
    teacher_email: value.teacher_email,
    teacher_notes: value.teacher_notes,
  };
}

// Controlled fields of a subject; the parent decides what "save" does.
export function SubjectFields({
  value,
  onChange,
  errors,
  showTeacherDetails = false,
}: {
  value: SubjectFormValue;
  onChange: (value: SubjectFormValue) => void;
  errors?: Record<string, string>;
  showTeacherDetails?: boolean;
}) {
  const [moreTeacher, setMoreTeacher] = useState(showTeacherDetails);
  const set = (patch: Partial<SubjectFormValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-5">
      <FormField label="Nombre de la materia" htmlFor="subject-name" error={errors?.name}>
        <Input
          id="subject-name"
          value={value.name}
          onChange={(event) => set({ name: event.target.value })}
          placeholder="Ej.: Cálculo Diferencial"
          maxLength={80}
          autoFocus
          required
        />
      </FormField>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Color</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
          {SUBJECT_COLOR_KEYS.map((key: SubjectColor) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value.color === key}
              aria-label={SUBJECT_COLORS[key].label}
              title={SUBJECT_COLORS[key].label}
              onClick={() => set({ color: key })}
              className={cn(
                "grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                SUBJECT_COLORS[key].swatch,
                value.color === key && "ring-2 ring-foreground",
              )}
            >
              {value.color === key ? <Check className="size-4" /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Ícono</span>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-11" role="radiogroup" aria-label="Ícono">
          {Object.entries(SUBJECT_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={value.icon === key}
              aria-label={key}
              onClick={() => set({ icon: key })}
              className={cn(
                "grid aspect-square place-items-center rounded-lg border text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                value.icon === key && cn("border-transparent", SUBJECT_COLORS[value.color as SubjectColor]?.soft),
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <FormField label="Docente (opcional)" htmlFor="teacher-name" error={errors?.teacher_name}>
        <Input
          id="teacher-name"
          value={value.teacher_name}
          onChange={(event) => set({ teacher_name: event.target.value })}
          placeholder="Nombre del profesor o profesora"
          maxLength={120}
        />
      </FormField>

      {moreTeacher ? (
        <>
          <FormField label="Correo del docente" htmlFor="teacher-email" error={errors?.teacher_email}>
            <Input
              id="teacher-email"
              type="email"
              value={value.teacher_email}
              onChange={(event) => set({ teacher_email: event.target.value })}
              maxLength={200}
            />
          </FormField>
          <FormField label="Horario de atención y contacto" htmlFor="teacher-notes" error={errors?.teacher_notes}>
            <Textarea
              id="teacher-notes"
              value={value.teacher_notes}
              onChange={(event) => set({ teacher_notes: event.target.value })}
              maxLength={1000}
              rows={2}
            />
          </FormField>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setMoreTeacher(true)}
          className="-mt-2 w-fit text-sm text-primary hover:underline"
        >
          + Agregar correo y horario del docente
        </button>
      )}
    </div>
  );
}
