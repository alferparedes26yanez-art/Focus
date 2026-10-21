import { ListTree, Sparkles, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { SubjectEvents } from "@/components/events/subject-events";
import { PageSkeleton } from "@/components/home/home-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SubjectStructure } from "@/components/structure/subject-structure";
import { SubjectHeader } from "@/components/subjects/subject-header";
import { SubjectTabs } from "@/components/subjects/subject-tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProfile, getSubjectDetail } from "@/lib/data/subjects";

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

  const [subject, profile, query] = await Promise.all([getSubjectDetail(subjectId), getProfile(), searchParams]);
  if (!subject) notFound();

  const syllabusUrl = `/subjects/${subject.id}/syllabus`;
  const reviewReady = subject.pendingImport?.status === "review";

  const topics =
    subject.units.length > 0 ? (
      <SubjectStructure subjectId={subject.id} units={subject.units} />
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
      <SubjectTabs
        defaultTab={query.tab === "evaluaciones" ? "evaluaciones" : "temas"}
        eventCount={subject.events.length}
        topics={topics}
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
