import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageSkeleton } from "@/components/home/home-skeleton";
import { StepsIndicator } from "@/components/onboarding/steps-indicator";
import { SubjectIcon } from "@/components/subjects/subject-icon";
import { ImportStatus } from "@/components/syllabus/import-status";
import { ReviewForm } from "@/components/syllabus/review-form";
import { getSubjectDetail } from "@/lib/data/subjects";
import { getSyllabusImport } from "@/lib/data/syllabus";

export const metadata: Metadata = { title: "Revisar sílabo" };

export default function SyllabusReviewPage(props: PageProps<"/subjects/[subjectId]/syllabus/[importId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewContent {...props} />
    </Suspense>
  );
}

async function ReviewContent({ params, searchParams }: PageProps<"/subjects/[subjectId]/syllabus/[importId]">) {
  const { subjectId, importId } = await params;
  if (!z.uuid().safeParse(subjectId).success || !z.uuid().safeParse(importId).success) notFound();

  const [subject, syllabusImport, query] = await Promise.all([
    getSubjectDetail(subjectId),
    getSyllabusImport(importId),
    searchParams,
  ]);
  if (!subject || !syllabusImport || syllabusImport.subjectId !== subject.id) notFound();
  if (syllabusImport.status === "applied") redirect(`/subjects/${subject.id}`);

  const onboarding = query.onboarding === "1";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      {onboarding ? (
        <StepsIndicator current={3} />
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
          <h1 className="text-xl font-semibold tracking-tight">Revisa tu sílabo</h1>
          <p className="text-sm text-muted-foreground">
            {subject.name}
            {syllabusImport.draft?.course_term ? ` · ${syllabusImport.draft.course_term}` : ""} · Corrige lo que
            haga falta antes de guardar.
          </p>
        </div>
      </header>

      {syllabusImport.status === "review" && syllabusImport.draft ? (
        <ReviewForm
          importId={syllabusImport.id}
          subjectId={subject.id}
          subjectName={subject.name}
          draft={syllabusImport.draft}
          currentTeacher={{
            name: subject.teacher_name ?? "",
            email: subject.teacher_email ?? "",
            notes: subject.teacher_notes ?? "",
          }}
          onboarding={onboarding}
        />
      ) : (
        <ImportStatus
          importId={syllabusImport.id}
          subjectId={subject.id}
          status={syllabusImport.status === "review" ? "failed" : syllabusImport.status}
          error={syllabusImport.status === "review" ? "El resultado guardado no es válido. Vuelve a leerlo." : syllabusImport.error}
          onboarding={onboarding}
        />
      )}
    </div>
  );
}
