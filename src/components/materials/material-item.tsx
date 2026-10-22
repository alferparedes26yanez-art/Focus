"use client";

import {
  ArrowRightLeft,
  Ellipsis,
  ExternalLink,
  LoaderCircle,
  Pencil,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import { useMenuFollowUp } from "@/components/shared/use-menu-follow-up";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deleteMaterial, renameMaterial, retryMaterial, setMaterialTopic } from "@/lib/actions/materials";
import type { UnitView } from "@/lib/data/subjects";
import { formatDuration } from "@/lib/materials/extract/youtube";
import { MATERIAL_KIND_LABELS, materialHref, progressNoun, type MaterialView } from "@/lib/materials/types";
import { cn } from "@/lib/utils";

import { MaterialIcon } from "./material-icon";
import { TopicSelect } from "./topic-select";

function readyDetail(material: MaterialView): string {
  const total = material.total_units ?? material.processed_units;
  switch (material.kind) {
    case "pdf":
    case "pptx":
    case "images":
      return `${MATERIAL_KIND_LABELS[material.kind]} · ${total} ${progressNoun(material.kind, total)}`;
    case "youtube":
      return material.duration_seconds
        ? `Video · ${formatDuration(material.duration_seconds)}`
        : MATERIAL_KIND_LABELS.youtube;
    case "web":
      try {
        return `Web · ${new URL(material.source_url ?? "").hostname.replace(/^www\./, "")}`;
      } catch {
        return MATERIAL_KIND_LABELS.web;
      }
    default:
      return MATERIAL_KIND_LABELS[material.kind];
  }
}

function MaterialStatus({ material }: { material: MaterialView }) {
  const [pending, startTransition] = useTransition();

  if (material.status === "ready") {
    return <p className="text-xs text-muted-foreground">{readyDetail(material)}</p>;
  }
  if (material.status === "failed") {
    return (
      <div className="grid gap-1.5">
        <p className="text-xs text-destructive">{material.error ?? "No pudimos leer este material."}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await retryMaterial(material.id);
              if (!result.ok) toast.error(result.error);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <RotateCw />}
          Reintentar
        </Button>
      </div>
    );
  }
  if (material.status === "uploading") {
    return <p className="text-xs text-muted-foreground">Subiendo…</p>;
  }
  if (material.status === "queued" && material.processed_units === 0) {
    return <p className="text-xs text-muted-foreground">En cola para leer…</p>;
  }

  const total = material.total_units;
  const done = material.processed_units;
  return (
    <div className="grid gap-1.5">
      <p className="text-xs text-muted-foreground">
        {material.kind === "youtube" ? "Transcribiendo" : "Leyendo"}
        {total ? ` · ${done} de ${total} ${progressNoun(material.kind, total)}` : "…"}
      </p>
      {total ? <Progress value={(done / total) * 100} className="h-1.5 max-w-60" /> : null}
    </div>
  );
}

const menuTriggerClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "shrink-0 text-muted-foreground md:opacity-0 md:group-hover/row:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100",
);

export function MaterialItem({
  subjectId,
  material,
  units,
}: {
  subjectId: string;
  material: MaterialView;
  units: UnitView[];
}) {
  const [dialog, setDialog] = useState<"topic" | "rename" | "delete" | null>(null);
  const afterMenu = useMenuFollowUp({
    topic: () => setDialog("topic"),
    rename: () => setDialog("rename"),
    delete: () => setDialog("delete"),
  });

  const openable = material.status === "ready" || material.processed_units > 0;
  const href = materialHref(subjectId, material.id);

  return (
    <li className="group/row flex items-start gap-3 rounded-xl border bg-card p-3">
      <MaterialIcon kind={material.kind} />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {openable ? (
            <Link href={href} className="line-clamp-2 min-w-0 font-medium break-words hover:underline">
              {material.title}
            </Link>
          ) : (
            <span className="line-clamp-2 min-w-0 font-medium break-words">{material.title}</span>
          )}
          {material.is_syllabus ? <Badge variant="secondary">Sílabo</Badge> : null}
          {material.topic_source === "ai" ? (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Sparkles className="size-3" />
              Sugerido por IA
            </Badge>
          ) : null}
        </div>
        <MaterialStatus material={material} />
      </div>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={menuTriggerClass} aria-label={`Opciones de ${material.title}`}>
          <Ellipsis className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={afterMenu.onCloseAutoFocus}>
          {!material.is_syllabus ? (
            <DropdownMenuItem onSelect={() => afterMenu.queue("topic")}>
              <ArrowRightLeft />
              Cambiar tema
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => afterMenu.queue("rename")}>
            <Pencil />
            Renombrar
          </DropdownMenuItem>
          {material.source_url ? (
            <DropdownMenuItem asChild>
              <a href={material.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Abrir original
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => afterMenu.queue("delete")}>
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TopicDialog
        open={dialog === "topic"}
        onOpenChange={(open) => setDialog(open ? "topic" : null)}
        material={material}
        units={units}
      />
      <RenameDialog
        open={dialog === "rename"}
        onOpenChange={(open) => setDialog(open ? "rename" : null)}
        material={material}
      />
      <DeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        material={material}
      />
    </li>
  );
}

function TopicDialog({
  open,
  onOpenChange,
  material,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialView;
  units: UnitView[];
}) {
  const id = useId();
  const current = material.topic_id ?? "general";
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const key = open ? current : null;
  if (key !== openedWith) {
    setOpenedWith(key);
    if (open) setValue(current);
  }

  const save = () =>
    startTransition(async () => {
      const result = await setMaterialTopic(material.id, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar tema</DialogTitle>
          <DialogDescription>¿A qué tema del sílabo pertenece «{material.title}»?</DialogDescription>
        </DialogHeader>
        <FormField label="Tema" htmlFor={id}>
          <TopicSelect id={id} units={units} value={value} onChange={setValue} />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialView;
}) {
  const id = useId();
  const [title, setTitle] = useState(material.title);
  const [pending, startTransition] = useTransition();

  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const key = open ? material.title : null;
  if (key !== openedWith) {
    setOpenedWith(key);
    if (open) setTitle(material.title);
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameMaterial(material.id, title);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Renombrar material</DialogTitle>
          </DialogHeader>
          <FormField label="Nombre" htmlFor={id}>
            <Input
              id={id}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              required
              autoFocus
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: MaterialView;
}) {
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await deleteMaterial(material.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Material eliminado.");
      onOpenChange(false);
    });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar «{material.title}»?</AlertDialogTitle>
          <AlertDialogDescription>
            {material.is_syllabus
              ? "Se quita de la biblioteca y el asistente ya no podrá citarlo. Las unidades, temas y fechas de la materia no cambian."
              : "Se borran el archivo y su texto; el asistente ya no podrá citarlo. No se puede deshacer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            Eliminar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
