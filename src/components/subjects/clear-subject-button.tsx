"use client";

import { Eraser } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { ClearSubjectDialog } from "./clear-subject-dialog";

export function ClearSubjectButton({ subjectId, subjectName }: { subjectId: string; subjectName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Eraser />
        Vaciar materia
      </Button>
      <ClearSubjectDialog open={open} onOpenChange={setOpen} subjectId={subjectId} subjectName={subjectName} />
    </>
  );
}
