"use client";

import { LoaderCircle } from "lucide-react";
import { useTransition } from "react";
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
import { clearSubject } from "@/lib/actions/subjects";

// "Vaciar materia": the way to load a new syllabus into a subject.
export function ClearSubjectDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
  onCleared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  onCleared?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await clearSubject(subjectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Materia vaciada. Ya puedes subir un sílabo nuevo.");
      onOpenChange(false);
      onCleared?.();
    });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Vaciar «{subjectName}»?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2">
              <p>Se borrará todo lo que viene del sílabo para que puedas cargar uno nuevo:</p>
              <ul className="list-disc pl-5">
                <li>unidades y temas</li>
                <li>exámenes, entregas y demás evaluaciones</li>
                <li>datos del docente y bibliografía</li>
                <li>los archivos del sílabo subidos</li>
              </ul>
              <p>Se conservan el nombre, el color y el ícono. No se puede deshacer.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Vaciar materia
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
