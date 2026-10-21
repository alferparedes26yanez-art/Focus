"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { SubjectDialog } from "./subject-dialog";

export function NewSubjectButton({
  children = "Nueva materia",
  ...props
}: React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        <Plus />
        {children}
      </Button>
      <SubjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// Dashed card used at the end of the subjects grid.
export function NewSubjectCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Plus className="size-5" />
        Nueva materia
      </button>
      <SubjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
