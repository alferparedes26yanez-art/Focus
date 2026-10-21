import { ArrowLeft, Eraser, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageSkeleton } from "@/components/home/home-skeleton";
import { StepsIndicator } from "@/components/onboarding/steps-indicator";
import { EmptyState } from "@/components/shared/empty-state";
import { ClearSubjectButton } from "@/components/subjects/clear-subject-button";
import { SubjectIcon } from "@/components/subjects/subject-icon";
import { SyllabusUploader } from "@/components/syllabus/syllabus-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSubjectDetail } from "@/lib/data/subjects";

export const metadata: Metadata = { title: "Subir sílabo" };

export default function SyllabusUploadPage(props: PageProps<"/subjects/[subjectId]/syllabus">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UploadContent {...props} />
    </Suspense>
  );
}

async function UploadContent({ params, searchParams }: PageProps<"/subjects/[subjectId]/syllabus">) {
  const { subjectId } = await params;
  if (!z.uuid().safeParse(subjectId).success) notFound();
  const [subject, query] = await Promise.all([getSubjectDetail(subjectId), searchParams]);
  if (!subject) notFound();

  const onboarding = query.onboarding === "1";
  const pending = subject.pendingImport;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      {onboarding ? (
        <StepsIndicator current={2} />
      ) : (
        <Link
          href={`/subjects/${subject.id}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {subject.name}
        </Link>
      )}

      <header className="flex items-center gap-3">
        <SubjectIcon color={subject.color} icon={subject.icon} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Subir sílabo</h1>
          <p className="text-sm text-muted-foreground">{subject.name}</p>
        </div>
      </header>

      {!subject.isEmpty ? (
        <EmptyState
          icon={Eraser}
          title="Esta materia ya tiene contenido"
          description="Para cargar un sílabo nuevo, primero vacía la materia: se borran sus unidades, temas, evaluaciones y datos del curso."
          action={
            <>
              <ClearSubjectButton subjectId={subject.id} subjectName={subject.name} />
              <Button variant="outline" asChild>
                <Link href={`/subjects/${subject.id}`}>Volver a la materia</Link>
              </Button>
            </>
          }
        />
      ) : (
        <>
          {pending?.status === "review" ? (
            <Alert>
              <Sparkles className="text-primary" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
                Ya tienes un sílabo listo para revisar.
                <Button asChild size="sm">
                  <Link href={`/subjects/${subject.id}/syllabus/${pending.id}${onboarding ? "?onboarding=1" : ""}`}>
                    Revisarlo
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <SyllabusUploader subjectId={subject.id} onboarding={onboarding} />
          <p className="text-center text-xs text-muted-foreground">
            Antes de guardar podrás revisar y corregir todo lo que encuentre la IA.
          </p>
        </>
      )}
    </div>
  );
}
