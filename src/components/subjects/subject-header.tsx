"use client";

import { ArrowLeft, Ellipsis, Eraser, Info, LoaderCircle, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteSubject } from "@/lib/actions/subjects";
import type { SubjectDetail } from "@/lib/data/subjects";

import { ClearSubjectDialog } from "./clear-subject-dialog";
import { CourseInfoDialog } from "./course-info-dialog";
import { SubjectDialog } from "./subject-dialog";
import { SubjectIcon } from "./subject-icon";

type Dialogs = "edit" | "info" | "clear" | "delete" | null;

export function SubjectHeader({ subject }: { subject: SubjectDetail }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [deleting, startDelete] = useTransition();
  const close = (open: boolean) => !open && setDialog(null);

  const remove = () =>
    startDelete(async () => {
      const result = await deleteSubject(subject.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`«${subject.name}» se borró`);
      router.replace("/home");
    });

  return (
    <header className="grid gap-4">
      <Link
        href="/home"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Inicio
      </Link>

      <div className="flex items-start gap-3 sm:gap-4">
        <SubjectIcon color={subject.color} icon={subject.icon} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{subject.name}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {subject.teacher_name ?? "Sin docente asignado"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {subject.isEmpty ? (
            <Button asChild className="hidden sm:inline-flex">
              <Link href={`/subjects/${subject.id}/syllabus`}>
                <Upload />
                Subir sílabo
              </Link>
            </Button>
          ) : null}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Opciones de la materia">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setDialog("edit")}>
                <Pencil />
                Editar materia
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("info")}>
                <Info />
                Información del curso
              </DropdownMenuItem>
              {subject.isEmpty ? (
                <DropdownMenuItem asChild>
                  <Link href={`/subjects/${subject.id}/syllabus`}>
                    <Upload />
                    Subir sílabo
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setDialog("clear")}>
                  <Eraser />
                  Vaciar para subir otro sílabo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2 />
                Borrar materia
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <SubjectDialog
        open={dialog === "edit"}
        onOpenChange={close}
        subjectId={subject.id}
        initialValue={{
          name: subject.name,
          color: subject.color,
          icon: subject.icon,
          teacher_name: subject.teacher_name ?? "",
          teacher_email: subject.teacher_email ?? "",
          teacher_notes: subject.teacher_notes ?? "",
        }}
      />
      <CourseInfoDialog
        open={dialog === "info"}
        onOpenChange={close}
        teacher={{ name: subject.teacher_name, email: subject.teacher_email, notes: subject.teacher_notes }}
        bibliography={subject.bibliography}
      />
      <ClearSubjectDialog
        open={dialog === "clear"}
        onOpenChange={close}
        subjectId={subject.id}
        subjectName={subject.name}
      />
      <AlertDialog open={dialog === "delete"} onOpenChange={(open) => !deleting && close(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{subject.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán la materia, sus unidades, temas, evaluaciones y archivos del sílabo. No se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : null}
              Borrar materia
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
