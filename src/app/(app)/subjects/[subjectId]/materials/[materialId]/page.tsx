import { ArrowLeft, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { PageSkeleton } from "@/components/home/home-skeleton";
import { MaterialIcon } from "@/components/materials/material-icon";
import { MaterialViewer } from "@/components/materials/viewer/material-viewer";
import { Badge } from "@/components/ui/badge";
import { getMaterialDetail } from "@/lib/data/materials";
import { MATERIAL_KIND_LABELS } from "@/lib/materials/types";

export const metadata: Metadata = { title: "Material" };

export default function MaterialPage(props: PageProps<"/subjects/[subjectId]/materials/[materialId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MaterialContent {...props} />
    </Suspense>
  );
}

const positiveInt = z.coerce.number().int().min(0).max(1_000_000);

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function MaterialContent({ params, searchParams }: PageProps<"/subjects/[subjectId]/materials/[materialId]">) {
  const [{ subjectId, materialId }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(subjectId).success || !z.uuid().safeParse(materialId).success) notFound();

  const page = positiveInt.safeParse(single(query.page));
  const seconds = positiveInt.safeParse(single(query.t));
  const chunk = z.uuid().safeParse(single(query.chunk));
  const focus = {
    page: page.success && page.data > 0 ? page.data : null,
    seconds: seconds.success ? seconds.data : null,
    chunkId: chunk.success ? chunk.data : null,
  };

  const detail = await getMaterialDetail(subjectId, materialId, focus.page);
  if (!detail) notFound();
  const { material, subject, topic } = detail;
  const topicLabel = topic
    ? topic.title
    : material.is_syllabus || material.topic_source === "general"
      ? "General"
      : "Sin ordenar";

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <Link
          href={`/subjects/${subject.id}?tab=material`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {subject.name}
        </Link>
        <div className="flex items-start gap-3">
          <MaterialIcon kind={material.kind} className="size-11" />
          <div className="grid min-w-0 gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight break-words">{material.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{MATERIAL_KIND_LABELS[material.kind]}</span>
              <span aria-hidden>·</span>
              <span>{topicLabel}</span>
              {material.topic_source === "ai" ? (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Sparkles className="size-3" />
                  Sugerido por IA
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <MaterialViewer detail={detail} focus={focus} />
    </div>
  );
}
