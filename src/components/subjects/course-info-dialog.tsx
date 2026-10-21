"use client";

import { BookMarked, Clock, ExternalLink, Mail, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { BibliographyItem } from "@/lib/syllabus/schemas";

export function CourseInfoDialog({
  open,
  onOpenChange,
  teacher,
  bibliography,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: { name: string | null; email: string | null; notes: string | null };
  bibliography: BibliographyItem[];
}) {
  const basic = bibliography.filter((item) => item.kind !== "complementary");
  const complementary = bibliography.filter((item) => item.kind === "complementary");
  const hasTeacher = Boolean(teacher.name || teacher.email || teacher.notes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Información del curso</DialogTitle>
          <DialogDescription>Datos del docente y bibliografía del sílabo.</DialogDescription>
        </DialogHeader>

        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Docente</h3>
          {hasTeacher ? (
            <ul className="grid gap-2 text-sm">
              {teacher.name ? (
                <li className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  {teacher.name}
                </li>
              ) : null}
              {teacher.email ? (
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <a href={`mailto:${teacher.email}`} className="text-primary hover:underline">
                    {teacher.email}
                  </a>
                </li>
              ) : null}
              {teacher.notes ? (
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="whitespace-pre-line">{teacher.notes}</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos. Puedes agregarlos en «Editar materia».</p>
          )}
        </section>

        <Separator />

        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <BookMarked className="size-4 text-muted-foreground" />
            Bibliografía
          </h3>
          {bibliography.length === 0 ? (
            <p className="text-sm text-muted-foreground">El sílabo no incluía bibliografía.</p>
          ) : (
            [
              { title: complementary.length > 0 ? "Básica" : null, items: basic },
              { title: "Complementaria", items: complementary },
            ]
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.title ?? "all"} className="grid gap-1.5">
                  {group.title ? (
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {group.title}
                    </p>
                  ) : null}
                  <ul className="grid list-disc gap-1.5 pl-5 text-sm">
                    {group.items.map((item, index) => (
                      <li key={index}>
                        {item.citation}
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                          >
                            enlace <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
