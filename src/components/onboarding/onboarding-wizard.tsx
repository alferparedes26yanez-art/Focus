"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { EMPTY_SUBJECT, SubjectFields, toSubjectInput, type SubjectFormValue } from "@/components/subjects/subject-form";
import { SyllabusUploader } from "@/components/syllabus/syllabus-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completeOnboarding } from "@/lib/actions/profile";
import { createSubject } from "@/lib/actions/subjects";

import { StepsIndicator } from "./steps-indicator";

// Steps 1 and 2 of the onboarding; step 3 is the review screen.
export function OnboardingWizard() {
  const router = useRouter();
  const [subject, setSubject] = useState<{ id: string; name: string } | null>(null);
  const [value, setValue] = useState<SubjectFormValue>(EMPTY_SUBJECT);
  const [errors, setErrors] = useState<Record<string, string>>();
  const [pending, startTransition] = useTransition();

  const create = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await createSubject(toSubjectInput(value));
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      setSubject({ id: result.data.id, name: value.name.trim() });
    });
  };

  const skip = () =>
    startTransition(async () => {
      await completeOnboarding();
      router.push(subject ? `/subjects/${subject.id}` : "/home");
    });

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <StepsIndicator current={subject ? 2 : 1} />

      {subject ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sube el sílabo de {subject.name}</CardTitle>
            <CardDescription>
              Focus extrae las unidades, los temas, las fechas de exámenes y entregas, y sus ponderaciones. Después
              podrás revisarlo todo antes de guardar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SyllabusUploader subjectId={subject.id} onboarding />
            <Button variant="ghost" className="w-fit justify-self-center" onClick={skip} disabled={pending}>
              Lo hago después
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Empecemos con tu primera materia</CardTitle>
            <CardDescription>Elige un nombre, un color y un ícono para reconocerla rápido.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-6">
              <SubjectFields value={value} onChange={setValue} errors={errors} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={skip} disabled={pending}>
                  Saltar por ahora
                </Button>
                <Button type="submit" disabled={pending || value.name.trim() === ""}>
                  {pending ? <LoaderCircle className="animate-spin" /> : null}
                  Continuar
                  <ArrowRight />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
