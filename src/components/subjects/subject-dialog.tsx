"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createSubject, updateSubject } from "@/lib/actions/subjects";

import { EMPTY_SUBJECT, SubjectFields, toSubjectInput, type SubjectFormValue } from "./subject-form";

// Create (no subjectId) or edit (with subjectId) a subject.
export function SubjectDialog({
  open,
  onOpenChange,
  subjectId,
  initialValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId?: string;
  initialValue?: SubjectFormValue;
}) {
  const router = useRouter();
  const [value, setValue] = useState<SubjectFormValue>(initialValue ?? EMPTY_SUBJECT);
  const [errors, setErrors] = useState<Record<string, string>>();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(subjectId);

  // Start from fresh values every time the dialog opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setValue(initialValue ?? EMPTY_SUBJECT);
      setErrors(undefined);
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const input = toSubjectInput(value);
      if (subjectId) {
        const result = await updateSubject(subjectId, input);
        if (!result.ok) {
          setErrors(result.fieldErrors);
          toast.error(result.error);
          return;
        }
        toast.success("Materia actualizada");
        onOpenChange(false);
      } else {
        const result = await createSubject(input);
        if (!result.ok) {
          setErrors(result.fieldErrors);
          toast.error(result.error);
          return;
        }
        onOpenChange(false);
        router.push(`/subjects/${result.data.id}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar materia" : "Nueva materia"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Cambia el nombre, color, ícono o datos del docente."
                : "Después podrás subir el sílabo para organizarla automáticamente."}
            </DialogDescription>
          </DialogHeader>
          <SubjectFields
            value={value}
            onChange={setValue}
            errors={errors}
            showTeacherDetails={Boolean(initialValue?.teacher_email || initialValue?.teacher_notes)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || value.name.trim() === ""}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              {isEdit ? "Guardar" : "Crear materia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
