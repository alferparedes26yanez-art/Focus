"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeft,
  ChevronRight,
  Ellipsis,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { AddItemInput } from "./add-item-input";
import { InlineEdit } from "./inline-edit";
import { isTempId, type TreeTopic, type TreeUnit } from "./structure-state";

export type StructureHandlers = {
  onAddUnit: (title: string) => void;
  onRenameUnit: (unitId: string, title: string) => void;
  onDeleteUnit: (unitId: string) => void;
  onReorderUnits: (unitIds: string[]) => void;
  onAddTopic: (unitId: string, title: string) => void;
  onRenameTopic: (topicId: string, title: string) => void;
  onDeleteTopic: (topicId: string) => void;
  onReorderTopics: (unitId: string, topicIds: string[]) => void;
  onMoveTopic: (topicId: string, toUnitId: string) => void;
};

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "Para mover este elemento, presiona espacio o Enter. Usa las flechas arriba y abajo para cambiar su posición y vuelve a presionar espacio o Enter para soltarlo. Escape cancela.",
};

const announcements: Announcements = {
  onDragStart: () => "Elemento tomado.",
  onDragOver: ({ over }) => (over ? "Moviendo." : "Fuera de la lista."),
  onDragEnd: ({ over }) => (over ? "Elemento soltado en su nueva posición." : "Elemento soltado."),
  onDragCancel: () => "Movimiento cancelado.",
};

function useListSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function reorderedIds(ids: string[], event: DragEndEvent): string[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;
  const from = ids.indexOf(String(active.id));
  const to = ids.indexOf(String(over.id));
  if (from < 0 || to < 0) return null;
  return arrayMove(ids, from, to);
}

// Menu items that open an input must wait until the menu has closed and
// released focus; otherwise the menu takes focus back and the input closes.
function useMenuFollowUp<K extends string>(actions: Record<K, () => void>) {
  const queued = useRef<K | null>(null);
  return {
    queue: (key: K) => {
      queued.current = key;
    },
    onCloseAutoFocus: (event: Event) => {
      const key = queued.current;
      queued.current = null;
      if (key) {
        event.preventDefault();
        actions[key]();
      }
    },
  };
}

const menuTriggerClass = cn(
  buttonVariants({ variant: "ghost", size: "icon-sm" }),
  "shrink-0 text-muted-foreground md:opacity-0 md:group-hover/row:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100",
);

export function StructureTree({
  units,
  handlers,
  emptyHint,
}: {
  units: TreeUnit[];
  handlers: StructureHandlers;
  emptyHint?: React.ReactNode;
}) {
  const sensors = useListSensors();
  // Stable id so server and client render the same aria attributes.
  const dndId = useId();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [unitToDelete, setUnitToDelete] = useState<TreeUnit | null>(null);
  const unitIds = units.map((unit) => unit.id);

  const toggle = (unitId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });

  return (
    <div className="grid gap-3">
      {units.length === 0 ? emptyHint : null}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ screenReaderInstructions, announcements }}
        onDragEnd={(event) => {
          const ids = reorderedIds(unitIds, event);
          if (ids) handlers.onReorderUnits(ids);
        }}
      >
        <SortableContext items={unitIds} strategy={verticalListSortingStrategy}>
          {units.map((unit, index) => (
            <SortableUnit
              key={unit.id}
              unit={unit}
              index={index}
              units={units}
              expanded={!collapsed.has(unit.id)}
              onToggle={() => toggle(unit.id)}
              onRequestDelete={() =>
                unit.topics.length === 0 ? handlers.onDeleteUnit(unit.id) : setUnitToDelete(unit)
              }
              handlers={handlers}
            />
          ))}
        </SortableContext>
      </DndContext>

      <AddItemInput
        label="Agregar unidad"
        placeholder="Nombre de la unidad y Enter"
        maxLength={200}
        onAdd={handlers.onAddUnit}
        className="w-fit"
      />

      <AlertDialog open={unitToDelete !== null} onOpenChange={(open) => !open && setUnitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{unitToDelete?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              También se borrarán sus {unitToDelete?.topics.length} temas. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (unitToDelete) handlers.onDeleteUnit(unitToDelete.id);
                setUnitToDelete(null);
              }}
            >
              Borrar unidad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableUnit({
  unit,
  index,
  units,
  expanded,
  onToggle,
  onRequestDelete,
  handlers,
}: {
  unit: TreeUnit;
  index: number;
  units: TreeUnit[];
  expanded: boolean;
  onToggle: () => void;
  onRequestDelete: () => void;
  handlers: StructureHandlers;
}) {
  const pending = isTempId(unit.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: unit.id, disabled: pending });
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const afterMenu = useMenuFollowUp({
    rename: () => setRenaming(true),
    add: () => {
      if (!expanded) onToggle();
      setAdding(true);
    },
  });
  const sensors = useListSensors();
  const dndId = useId();
  const topicIds = unit.topics.map((topic) => topic.id);

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={unit.title}
      className={cn(
        "rounded-xl border bg-card shadow-xs",
        isDragging && "relative z-10 shadow-lg ring-2 ring-primary/40",
        pending && "opacity-60",
      )}
    >
      <div className="group/row flex items-center gap-1 p-2 sm:p-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastrar para reordenar ${unit.title}`}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Contraer unidad" : "Expandir unidad"}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
        </button>
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={unit.title}
            ariaLabel="Nombre de la unidad"
            maxLength={200}
            disabled={pending}
            editing={renaming}
            onEditingChange={setRenaming}
            onSave={(title) => handlers.onRenameUnit(unit.id, title)}
            className="font-medium"
          />
        </div>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {unit.topics.length} {unit.topics.length === 1 ? "tema" : "temas"}
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className={menuTriggerClass} disabled={pending} aria-label="Opciones de la unidad">
            <Ellipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onCloseAutoFocus={afterMenu.onCloseAutoFocus}>
            <DropdownMenuItem onSelect={() => afterMenu.queue("rename")}>
              <Pencil />
              Renombrar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => afterMenu.queue("add")}>
              <Plus />
              Agregar tema
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
              <Trash2 />
              Borrar unidad
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded ? (
        <div className="border-t px-2 py-2 sm:px-3">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{ screenReaderInstructions, announcements }}
            onDragEnd={(event) => {
              const ids = reorderedIds(topicIds, event);
              if (ids) handlers.onReorderTopics(unit.id, ids);
            }}
          >
            <SortableContext items={topicIds} strategy={verticalListSortingStrategy}>
              <ol className="grid gap-0.5">
                {unit.topics.map((topic, topicIndex) => (
                  <SortableTopic
                    key={topic.id}
                    topic={topic}
                    number={`${index + 1}.${topicIndex + 1}`}
                    unitId={unit.id}
                    units={units}
                    handlers={handlers}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          {unit.topics.length === 0 && !adding ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">Esta unidad no tiene temas todavía.</p>
          ) : null}
          {pending ? null : (
            <AddItemInput
              open={adding}
              onOpenChange={setAdding}
              label="Agregar tema"
              placeholder="Nombre del tema y Enter"
              maxLength={300}
              onAdd={(title) => handlers.onAddTopic(unit.id, title)}
              className="mt-1"
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

function SortableTopic({
  topic,
  number,
  unitId,
  units,
  handlers,
}: {
  topic: TreeTopic;
  number: string;
  unitId: string;
  units: TreeUnit[];
  handlers: StructureHandlers;
}) {
  const pending = isTempId(topic.id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id, disabled: pending });
  const [renaming, setRenaming] = useState(false);
  const afterMenu = useMenuFollowUp({ rename: () => setRenaming(true) });
  const otherUnits = units.filter((unit) => unit.id !== unitId && !isTempId(unit.id));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row flex items-start gap-1 rounded-lg bg-card py-0.5",
        isDragging && "relative z-10 shadow-md ring-2 ring-primary/40",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar para reordenar ${topic.title}`}
        className="mt-0.5 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground/70 hover:bg-accent active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <span className="mt-1.5 w-8 shrink-0 text-xs text-muted-foreground tabular-nums">{number}</span>
      <div className="min-w-0 flex-1">
        <InlineEdit
          value={topic.title}
          ariaLabel="Nombre del tema"
          maxLength={300}
          disabled={pending}
          editing={renaming}
          onEditingChange={setRenaming}
          onSave={(title) => handlers.onRenameTopic(topic.id, title)}
          className="text-sm"
        />
        {topic.description ? (
          <p className="line-clamp-2 px-2 pb-1 text-xs text-muted-foreground">{topic.description}</p>
        ) : null}
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={menuTriggerClass} disabled={pending} aria-label="Opciones del tema">
          <Ellipsis className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={afterMenu.onCloseAutoFocus}>
          <DropdownMenuItem onSelect={() => afterMenu.queue("rename")}>
            <Pencil />
            Renombrar
          </DropdownMenuItem>
          {otherUnits.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft />
                Mover a…
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherUnits.map((unit) => (
                  <DropdownMenuItem key={unit.id} onSelect={() => handlers.onMoveTopic(topic.id, unit.id)}>
                    <span className="max-w-56 truncate">{unit.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => handlers.onDeleteTopic(topic.id)}>
            <Trash2 />
            Borrar tema
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
