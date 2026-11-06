import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageSkeleton } from "@/components/home/home-skeleton";
import { NotebookEditor } from "@/components/notebook/notebook-editor";
import { requireUser } from "@/lib/auth";
import { getNotebookPage } from "@/lib/data/notebook";
import { getSubjectDetail } from "@/lib/data/subjects";

export const metadata: Metadata = { title: "Cuaderno" };

export default function NotebookPage(props: PageProps<"/subjects/[subjectId]/notebook/[pageId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotebookContent {...props} />
    </Suspense>
  );
}

async function NotebookContent({ params, searchParams }: PageProps<"/subjects/[subjectId]/notebook/[pageId]">) {
  const [{ subjectId, pageId }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(subjectId).success || !z.uuid().safeParse(pageId).success) notFound();

  const [{ userId }, page, subject] = await Promise.all([
    requireUser(),
    getNotebookPage(subjectId, pageId),
    getSubjectDetail(subjectId),
  ]);
  if (!page || !subject) notFound();

  const section = typeof query.section === "string" ? query.section.slice(0, 300) : null;

  return (
    <NotebookEditor
      // A fresh editor when moving between pages.
      key={page.id}
      page={page}
      subjectName={subject.name}
      units={subject.units}
      userId={userId}
      focusSection={section}
    />
  );
}
