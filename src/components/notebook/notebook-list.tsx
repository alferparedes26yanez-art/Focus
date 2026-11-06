"use client";

import { LoaderCircle, NotebookPen, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createNotebookPage } from "@/lib/actions/notebook";
import { formatClassDate } from "@/lib/notebook/document";
import type { NotebookPageSummary } from "@/lib/notebook/types";

export function NotebookList({
  subjectId,
  pages,
  topicTitles,
}: {
  subjectId: string;
  pages: NotebookPageSummary[];
  topicTitles: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createNotebookPage(subjectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/subjects/${subjectId}/notebook/${result.data.id}`);
    });

  const newButton = (
    <Button onClick={create} disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
      Nueva página
    </Button>
  );

  if (pages.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="Tu cuaderno está vacío"
        description="Toma apuntes de cada clase con títulos, listas, tablas e imágenes. El asistente también podrá citarlos."
        action={newButton}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pages.length === 1 ? "1 página" : `${pages.length} páginas`}
        </p>
        {newButton}
      </div>
      <ul className="grid gap-2">
        {pages.map((page) => (
          <li key={page.id}>
            <Link
              href={`/subjects/${subjectId}/notebook/${page.id}`}
              className="grid gap-1 rounded-xl border bg-card p-3 transition hover:border-primary/40 hover:bg-accent/40"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {formatClassDate(page.class_date)}
                </span>
                <span className="line-clamp-2 min-w-0 font-medium break-words">{page.title}</span>
                {page.topic_id && topicTitles[page.topic_id] ? (
                  <Badge variant="outline" className="max-w-full truncate text-muted-foreground">
                    {topicTitles[page.topic_id]}
                  </Badge>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{page.preview || "Página vacía"}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
