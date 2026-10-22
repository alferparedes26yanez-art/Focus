"use client";

import { Library, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { UnitView } from "@/lib/data/subjects";
import { isUnclassified, type MaterialView } from "@/lib/materials/types";

import { MaterialItem } from "./material-item";

async function classifyRound(subjectId: string) {
  try {
    const response = await fetch(`/api/subjects/${subjectId}/classify`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as
      | { classified?: number; remaining?: number; error?: string }
      | null;
    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "No se pudo ordenar el material.", classified: body?.classified ?? 0 };
    }
    return { ok: true as const, classified: body?.classified ?? 0, remaining: body?.remaining ?? 0 };
  } catch {
    return { ok: false as const, error: "Se perdió la conexión. Inténtalo de nuevo.", classified: 0 };
  }
}

function Group({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// The library follows the syllabus: material is shown under its unit and
// topic, in course order. General material and what is still unclassified go
// in their own groups.
export function MaterialLibrary({
  subjectId,
  units,
  materials,
}: {
  subjectId: string;
  units: UnitView[];
  materials: MaterialView[];
}) {
  const router = useRouter();
  const [classifying, setClassifying] = useState(false);

  if (materials.length === 0) {
    return (
      <EmptyState
        icon={Library}
        title="Todavía no hay material"
        description="Sube diapositivas, apuntes, libros o videos. Focus los lee, los ordena según el sílabo y después el asistente te responde citando la página o el minuto exacto."
      />
    );
  }

  const hasTopics = units.some((unit) => unit.topics.length > 0);
  const unclassified = materials.filter((material) => !material.is_syllabus && isUnclassified(material));
  const classifiable = unclassified.filter((material) => material.processed_units > 0).length;
  const general = materials
    .filter((material) => material.is_syllabus || (!material.topic_id && material.topic_source === "general"))
    .sort((a, b) => Number(b.is_syllabus) - Number(a.is_syllabus));
  const byTopic = new Map<string, MaterialView[]>();
  for (const material of materials) {
    if (!material.topic_id || material.is_syllabus) continue;
    byTopic.set(material.topic_id, [...(byTopic.get(material.topic_id) ?? []), material]);
  }

  const classify = async () => {
    setClassifying(true);
    let total = 0;
    let error: string | null = null;
    for (let round = 0; round < 10; round++) {
      const result = await classifyRound(subjectId);
      total += result.classified;
      if (!result.ok) {
        error = result.error;
        break;
      }
      if (result.remaining === 0 || result.classified === 0) break;
    }
    setClassifying(false);
    router.refresh();
    if (error) toast.error(error);
    else if (total > 0) toast.success(total === 1 ? "Se ordenó 1 material." : `Se ordenaron ${total} materiales.`);
    else toast.info("No había material listo para ordenar.");
  };

  const list = (items: MaterialView[]) => (
    <ul className="grid gap-2">
      {items.map((material) => (
        <MaterialItem key={material.id} subjectId={subjectId} material={material} units={units} />
      ))}
    </ul>
  );

  return (
    <div className="grid gap-6">
      {unclassified.length > 0 ? (
        <Group
          title={`Sin ordenar (${unclassified.length})`}
          description={
            hasTopics
              ? "La IA los ubica en su tema apenas los lee. También puedes elegir el tema desde el menú."
              : "Cuando cargues el sílabo (o agregues temas), podrás ordenarlos por tema."
          }
          action={
            hasTopics && classifiable > 0 ? (
              <Button size="sm" variant="outline" onClick={classify} disabled={classifying}>
                {classifying ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Ordenar según el sílabo ({classifiable})
              </Button>
            ) : null
          }
        >
          {list(unclassified)}
        </Group>
      ) : null}

      {general.length > 0 ? (
        <Group title="General" description="Sirve para toda la materia.">
          {list(general)}
        </Group>
      ) : null}

      {units.map((unit) => {
        const topics = unit.topics.filter((topic) => byTopic.has(topic.id));
        if (topics.length === 0) return null;
        return (
          <section key={unit.id} className="grid gap-3">
            <h3 className="text-sm font-semibold">{unit.title}</h3>
            <div className="grid gap-4 border-l-2 pl-3 sm:pl-4">
              {topics.map((topic) => (
                <div key={topic.id} className="grid gap-2">
                  <p className="text-sm text-muted-foreground">{topic.title}</p>
                  {list(byTopic.get(topic.id) ?? [])}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
