import { ListTree, Sparkles, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { SubjectChat } from "@/components/chat/subject-chat";
import { SubjectEvents } from "@/components/events/subject-events";
import { PageSkeleton } from "@/components/home/home-skeleton";
import { MaterialProcessor } from "@/components/materials/material-processor";
import { SubjectMaterials } from "@/components/materials/subject-materials";
import { EmptyState } from "@/components/shared/empty-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { SubjectStructure } from "@/components/structure/subject-structure";
import { SubjectHeader } from "@/components/subjects/subject-header";
import { SubjectTabs } from "@/components/subjects/subject-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { parseSubjectTab } from "@/lib/constants/subject-tabs";
import { getChatThreads } from "@/lib/data/chat";
import { MissingTableError } from "@/lib/data/errors";
import { getSubjectMaterials } from "@/lib/data/materials";
import { getProfile, getSubjectDetail, type SubjectDetail } from "@/lib/data/subjects";
import type { MaterialView } from "@/lib/materials/types";

export const metadata: Metadata = { title: "Materia" };

export default function SubjectPage(props: PageProps<"/subjects/[subjectId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SubjectContent {...props} />
    </Suspense>
  );
}

async function SubjectContent({ params, searchParams }: PageProps<"/subjects/[subjectId]">) {
  const { subjectId } = await params;
  if (!z.uuid().safeParse(subjectId).success) notFound();

  const [subject, profile, query, library] = await Promise.all([
    getSubjectDetail(subjectId),
    getProfile(),
    searchParams,
    getLibrary(subjectId),
  ]);
  if (!subject) notFound();
  const { materials, threads } = library;

  const materialCounts: Record<string, number> = {};
  for (const material of materials) {
    if (material.topic_id) materialCounts[material.topic_id] = (materialCounts[material.topic_id] ?? 0) + 1;
  }
  const pendingIds = materials
    .filter((material) => material.status === "queued" || material.status === "processing")
    .map((material) => material.id);
  const tab = parseSubjectTab(query.tab);

  const syllabusUrl = `/subjects/${subject.id}/syllabus`;
  const reviewReady = subject.pendingImport?.status === "review";

  const topics =
    subject.units.length > 0 ? (
      <SubjectStructure subjectId={subject.id} units={subject.units} materialCounts={materialCounts} />
    ) : (
      <div className="grid gap-4">
        {reviewReady ? (
          <Alert>
            <Sparkles className="text-primary" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
              Tu sílabo está listo para revisar.
              <Button asChild size="sm">
                <Link href={`${syllabusUrl}/${subject.pendingImport!.id}`}>Revisar ahora</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        <EmptyState
          icon={ListTree}
          title="Organiza esta materia"
          description="Sube el sílabo y Focus crea las unidades, los temas y las fechas por ti. También puedes agregarlos a mano."
          action={
            <>
              <Button asChild>
                <Link href={syllabusUrl}>
                  <Upload />
                  Subir sílabo
                </Link>
              </Button>
            </>
          }
        />
        <SubjectStructure subjectId={subject.id} units={[]} />
      </div>
    );

  return (
    <div className="grid gap-6">
      <SubjectHeader subject={subject} />
      <MaterialProcessor pendingIds={pendingIds} />
      <SubjectTabs
        defaultTab={tab}
        materialCount={materials.length}
        eventCount={subject.events.length}
        topics={topics}
        materials={
          library.ready ? (
            <SubjectMaterials subjectId={subject.id} units={subject.units} materials={materials} />
          ) : (
            <SetupNotice migrations={PHASE_2_MIGRATIONS} />
          )
        }
        chat={
          library.ready ? (
            <SubjectChat
              subjectId={subject.id}
              threads={threads}
              hasMaterial={materials.some((material) => material.processed_units > 0)}
              suggestions={chatSuggestions(subject, materials)}
            />
          ) : (
            <SetupNotice migrations={PHASE_2_MIGRATIONS} />
          )
        }
        events={
          <SubjectEvents
            subjectId={subject.id}
            events={subject.events}
            units={subject.units}
            today={profile.today}
          />
        }
      />
    </div>
  );
}

const PHASE_2_MIGRATIONS = ["20261022000700_materials.sql", "20261022000800_chat.sql"];

// Material and chat need the Phase 2 migrations; without them the rest of the
// subject still works and those tabs explain what to run.
async function getLibrary(subjectId: string) {
  try {
    const [materials, threads] = await Promise.all([getSubjectMaterials(subjectId), getChatThreads(subjectId)]);
    return { ready: true, materials, threads };
  } catch (error) {
    if (!(error instanceof MissingTableError)) throw error;
    console.error("[subject] Phase 2 tables are missing:", error.message);
    return { ready: false, materials: [] as MaterialView[], threads: [] };
  }
}

// Starting questions for an empty chat, from the subject's own content.
function chatSuggestions(subject: SubjectDetail, materials: MaterialView[]): string[] {
  const suggestions: string[] = [];
  const firstTopic = subject.units.flatMap((unit) => unit.topics)[0];
  if (firstTopic) suggestions.push(`Explícame «${firstTopic.title.slice(0, 60)}»`);
  if (subject.events.length > 0 && materials.some((material) => material.is_syllabus)) {
    suggestions.push("¿Qué entra en el próximo examen?");
  }
  suggestions.push("Resume los puntos clave de la materia");
  return suggestions;
}
