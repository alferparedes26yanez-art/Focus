"use client";

import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_KIND_LABELS, EVENT_KINDS, type EventKind } from "@/lib/constants/events";
import { cn } from "@/lib/utils";

// Form values as typed in the inputs (strings); converted on save.
export type EventFormValue = {
  kind: EventKind;
  title: string;
  event_date: string;
  event_time: string;
  weight: string;
  notes: string;
  unit_ids: string[];
};

export const EMPTY_EVENT: EventFormValue = {
  kind: "exam",
  title: "",
  event_date: "",
  event_time: "",
  weight: "",
  notes: "",
  unit_ids: [],
};

export function parseWeight(weight: string): number | null {
  if (weight.trim() === "") return null;
  const value = Number(weight.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function EventFields({
  idPrefix,
  value,
  onChange,
  units,
  errors,
  compact = false,
}: {
  idPrefix: string;
  value: EventFormValue;
  onChange: (value: EventFormValue) => void;
  units: { id: string; title: string }[];
  errors?: Record<string, string>;
  compact?: boolean;
}) {
  const set = (patch: Partial<EventFormValue>) => onChange({ ...value, ...patch });
  const toggleUnit = (unitId: string) =>
    set({
      unit_ids: value.unit_ids.includes(unitId)
        ? value.unit_ids.filter((id) => id !== unitId)
        : [...value.unit_ids, unitId],
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <FormField label="Tipo" htmlFor={`${idPrefix}-kind`}>
          <NativeSelect
            id={`${idPrefix}-kind`}
            value={value.kind}
            onChange={(event) => set({ kind: event.target.value as EventKind })}
          >
            {EVENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {EVENT_KIND_LABELS[kind]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Nombre" htmlFor={`${idPrefix}-title`} error={errors?.title}>
          <Input
            id={`${idPrefix}-title`}
            value={value.title}
            onChange={(event) => set({ title: event.target.value })}
            placeholder="Ej.: Primer parcial"
            maxLength={200}
            aria-invalid={Boolean(errors?.title)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <FormField
          label="Fecha"
          htmlFor={`${idPrefix}-date`}
          error={errors?.event_date}
          hint={value.event_date ? undefined : "Vacía = por confirmar"}
        >
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={value.event_date}
            onChange={(event) => set({ event_date: event.target.value })}
            aria-invalid={Boolean(errors?.event_date)}
            className={cn(!value.event_date && "border-warning-foreground/40 bg-warning/40")}
          />
        </FormField>
        <FormField label="Hora" htmlFor={`${idPrefix}-time`} error={errors?.event_time}>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={value.event_time}
            onChange={(event) => set({ event_time: event.target.value })}
          />
        </FormField>
        <FormField label="Ponderación (%)" htmlFor={`${idPrefix}-weight`} error={errors?.weight}>
          <Input
            id={`${idPrefix}-weight`}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="any"
            value={value.weight}
            onChange={(event) => set({ weight: event.target.value })}
            placeholder="—"
            aria-invalid={Boolean(errors?.weight)}
          />
        </FormField>
      </div>

      {units.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Unidades que entran</legend>
          <div className="flex flex-wrap gap-1.5">
            {units.map((unit, index) => {
              const selected = value.unit_ids.includes(unit.id);
              return (
                <button
                  key={unit.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleUnit(unit.id)}
                  title={unit.title}
                  className={cn(
                    "max-w-full truncate rounded-full border px-3 py-1 text-xs transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:max-w-64",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {compact ? `Unidad ${index + 1}` : unit.title}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {compact && !value.notes ? null : (
        <FormField label="Notas" htmlFor={`${idPrefix}-notes`}>
          <Textarea
            id={`${idPrefix}-notes`}
            value={value.notes}
            onChange={(event) => set({ notes: event.target.value })}
            maxLength={1000}
            rows={2}
          />
        </FormField>
      )}
    </div>
  );
}
