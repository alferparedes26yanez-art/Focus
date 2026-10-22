"use client";

import { NativeSelect } from "@/components/ui/native-select";
import type { UnitView } from "@/lib/data/subjects";

// Where a material is filed: a syllabus topic, the whole subject, or (for new
// material) let the AI decide.
export function TopicSelect({
  id,
  units,
  value,
  onChange,
  includeAuto = false,
  disabled,
}: {
  id?: string;
  units: Pick<UnitView, "id" | "title" | "topics">[];
  value: string;
  onChange: (value: string) => void;
  includeAuto?: boolean;
  disabled?: boolean;
}) {
  const hasTopics = units.some((unit) => unit.topics.length > 0);
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {includeAuto ? (
        <option value="auto">
          {hasTopics ? "Que la IA lo ordene (recomendado)" : "Que la IA lo ordene cuando haya sílabo"}
        </option>
      ) : null}
      <option value="general">General (toda la materia)</option>
      {units
        .filter((unit) => unit.topics.length > 0)
        .map((unit) => (
          <optgroup key={unit.id} label={unit.title}>
            {unit.topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </optgroup>
        ))}
    </NativeSelect>
  );
}
