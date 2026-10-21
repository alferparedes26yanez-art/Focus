"use client";

import {
  BookMarked,
  CalendarDays,
  ChevronDown,
  ListTree,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { DateBlock } from "@/components/events/event-date";
import { EMPTY_EVENT, EventFields, parseWeight, type EventFormValue } from "@/components/events/event-fields";
import { WeightSummary } from "@/components/events/weight-summary";
import { FormField } from "@/components/shared/form-field";
import { structureReducer, type StructureAction, type TreeUnit } from "@/components/structure/structure-state";
import { StructureTree, type StructureHandlers } from "@/components/structure/structure-tree";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applySyllabusImport, discardSyllabusImport } from "@/lib/actions/syllabus";
import { EVENT_KIND_LABELS } from "@/lib/constants/events";
import { formatTime } from "@/lib/dates";
import { syllabusApplySchema, type BibliographyItem, type SyllabusDraft } from "@/lib/syllabus/schemas";
import { cn } from "@/lib/utils";

type ReviewEvent = EventFormValue & { id: string };
type Teacher = { name: string; email: string; notes: string };

function newId() {
  return crypto.randomUUID();
}

function initialState(draft: SyllabusDraft, fallbackTeacher: Teacher) {
  const units: TreeUnit[] = draft.units.map((unit, unitIndex) => ({
    id: `u-${unitIndex}`,
    title: unit.title,
    topics: unit.topics.map((topic, topicIndex) => ({
      id: `t-${unitIndex}-${topicIndex}`,
      title: topic.title,
      description: topic.description,
    })),
  }));
  const events: ReviewEvent[] = draft.events.map((event, index) => ({
    id: `e-${index}`,
    kind: event.kind,
    title: event.title,
    event_date: event.event_date ?? "",
    event_time: event.event_time ?? "",
    weight: event.weight === null ? "" : String(event.weight),
    notes: event.notes ?? "",
    unit_ids: event.unit_indexes.map((unitIndex) => `u-${unitIndex}`).filter((id) => units.some((u) => u.id === id)),
  }));
  const teacher: Teacher = {
    name: draft.teacher.name ?? fallbackTeacher.name,
    email: draft.teacher.email ?? fallbackTeacher.email,
    notes: draft.teacher.notes ?? fallbackTeacher.notes,
  };
  return { units, events, teacher, bibliography: draft.bibliography };
}

export function ReviewForm({
  importId,
  subjectId,
  subjectName,
  draft,
  currentTeacher,
  onboarding,
}: {
  importId: string;
  subjectId: string;
  subjectName: string;
  draft: SyllabusDraft;
  currentTeacher: Teacher;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [initial] = useState(() => initialState(draft, currentTeacher));
  const [units, setUnits] = useState<TreeUnit[]>(initial.units);
  const [events, setEvents] = useState<ReviewEvent[]>(initial.events);
  const [teacher, setTeacher] = useState<Teacher>(initial.teacher);
  const [bibliography, setBibliography] = useState<BibliographyItem[]>(initial.bibliography);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [discarding, startDiscarding] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Warn before leaving with unsaved corrections.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const dispatch = (action: StructureAction) => {
    setDirty(true);
    setUnits((current) => structureReducer(current, action));
  };

  const handlers: StructureHandlers = {
    onAddUnit: (title) => dispatch({ type: "addUnit", unit: { id: newId(), title, topics: [] } }),
    onRenameUnit: (unitId, title) => dispatch({ type: "renameUnit", unitId, title }),
    onDeleteUnit: (unitId) => dispatch({ type: "deleteUnit", unitId }),
    onReorderUnits: (unitIds) => dispatch({ type: "reorderUnits", unitIds }),
    onAddTopic: (unitId, title) =>
      dispatch({ type: "addTopic", unitId, topic: { id: newId(), title, description: null } }),
    onRenameTopic: (topicId, title) => dispatch({ type: "renameTopic", topicId, title }),
    onDeleteTopic: (topicId) => dispatch({ type: "deleteTopic", topicId }),
    onReorderTopics: (unitId, topicIds) => dispatch({ type: "reorderTopics", unitId, topicIds }),
    onMoveTopic: (topicId, toUnitId) => dispatch({ type: "moveTopic", topicId, toUnitId }),
  };

  const updateEvent = (id: string, value: EventFormValue) => {
    setDirty(true);
    setEvents((current) => current.map((event) => (event.id === id ? { ...value, id } : event)));
  };

  const addEvent = () => {
    const id = newId();
    setDirty(true);
    setEvents((current) => [...current, { ...EMPTY_EVENT, id }]);
    setExpandedEvent(id);
  };

  const removeEvent = (id: string) => {
    setDirty(true);
    setEvents((current) => current.filter((event) => event.id !== id));
  };

  const unitOptions = units.map((unit) => ({ id: unit.id, title: unit.title }));
  const topicCount = units.reduce((sum, unit) => sum + unit.topics.length, 0);
  const undated = events.filter((event) => !event.event_date && event.kind !== "other").length;

  const save = () => {
    const invalidWeight = events.find((event) => event.weight.trim() !== "" && parseWeight(event.weight) === null);
    if (invalidWeight) {
      setExpandedEvent(invalidWeight.id);
      toast.error(`La ponderación de «${invalidWeight.title || "una evaluación"}» no es un número.`);
      return;
    }
    const untitled = events.find((event) => event.title.trim() === "");
    if (untitled) {
      setExpandedEvent(untitled.id);
      toast.error("Una evaluación no tiene nombre.");
      return;
    }

    const unitIndex = new Map(units.map((unit, index) => [unit.id, index]));
    const payload = {
      units: units.map((unit) => ({
        title: unit.title,
        topics: unit.topics.map((topic) => ({ title: topic.title, description: topic.description })),
      })),
      events: events.map((event) => ({
        kind: event.kind,
        title: event.title.trim(),
        event_date: event.event_date || null,
        event_time: event.event_time || null,
        weight: parseWeight(event.weight),
        notes: event.notes.trim() || null,
        unit_indexes: event.unit_ids
          .map((id) => unitIndex.get(id))
          .filter((index): index is number => index !== undefined),
      })),
      teacher: {
        name: teacher.name.trim() || null,
        email: teacher.email.trim() || null,
        notes: teacher.notes.trim() || null,
      },
      bibliography,
    };

    const parsed = syllabusApplySchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(`Revisa el formulario: ${parsed.error.issues[0].message}.`);
      return;
    }

    startSaving(async () => {
      const result = await applySyllabusImport(importId, parsed.data, { completeOnboarding: onboarding });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      const { units: u, topics: t, events: e } = result.data;
      toast.success(`¡Listo! ${subjectName}: ${u} unidades, ${t} temas y ${e} evaluaciones.`);
      router.push(`/subjects/${subjectId}`);
    });
  };

  const discard = () =>
    startDiscarding(async () => {
      const result = await discardSyllabusImport(importId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      router.push(`/subjects/${subjectId}/syllabus${onboarding ? "?onboarding=1" : ""}`);
    });

  return (
    <div className="grid gap-5">
      {draft.warnings.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Revisa estos puntos</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {draft.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTree className="size-4 text-primary" />
            Unidades y temas
          </CardTitle>
          <CardDescription>
            {units.length} unidades · {topicCount} temas. Haz clic en un nombre para corregirlo y arrastra para
            cambiar el orden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StructureTree
            units={units}
            handlers={handlers}
            emptyHint={
              <p className="text-sm text-muted-foreground">
                No se encontraron unidades. Agrégalas a mano o descarta y prueba con otro archivo.
              </p>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            Evaluaciones y fechas
          </CardTitle>
          <CardDescription>
            {events.length} evaluaciones
            {undated > 0 ? ` · ${undated} sin fecha exacta (resaltadas)` : ""}. Toca una para editarla.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <WeightSummary weights={events.map((event) => parseWeight(event.weight))} />
          <ul className="grid gap-2">
            {events.map((event) => {
              const expanded = expandedEvent === event.id;
              const missingDate = !event.event_date && event.kind !== "other";
              return (
                <li
                  key={event.id}
                  className={cn("rounded-xl border", missingDate && "border-warning-foreground/30 bg-warning/30")}
                >
                  <div className="flex items-center gap-3 p-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedEvent(expanded ? null : event.id)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <DateBlock date={event.event_date || null} className="bg-background" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{event.title || "Sin nombre"}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <Badge variant="secondary">{EVENT_KIND_LABELS[event.kind]}</Badge>
                          {event.event_time ? <span>{formatTime(event.event_time)}</span> : null}
                          {event.weight ? <span>{event.weight} %</span> : null}
                          {event.unit_ids.length > 0 ? (
                            <span>
                              {event.unit_ids.length === 1 ? "1 unidad" : `${event.unit_ids.length} unidades`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn("size-4 shrink-0 text-muted-foreground transition", expanded && "rotate-180")}
                      />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${event.title || "evaluación"}`}
                      onClick={() => removeEvent(event.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {expanded ? (
                    <div className="border-t p-3">
                      <EventFields
                        idPrefix={`review-${event.id}`}
                        value={event}
                        onChange={(value) => updateEvent(event.id, value)}
                        units={unitOptions}
                        compact
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEvent}>
            <Plus />
            Agregar evaluación
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            Docente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombre" htmlFor="review-teacher-name">
            <Input
              id="review-teacher-name"
              value={teacher.name}
              maxLength={120}
              onChange={(event) => {
                setDirty(true);
                setTeacher({ ...teacher, name: event.target.value });
              }}
            />
          </FormField>
          <FormField label="Correo" htmlFor="review-teacher-email">
            <Input
              id="review-teacher-email"
              type="email"
              value={teacher.email}
              maxLength={200}
              onChange={(event) => {
                setDirty(true);
                setTeacher({ ...teacher, email: event.target.value });
              }}
            />
          </FormField>
          <FormField label="Horario de atención y contacto" htmlFor="review-teacher-notes" className="sm:col-span-2">
            <Textarea
              id="review-teacher-notes"
              value={teacher.notes}
              maxLength={1000}
              rows={2}
              onChange={(event) => {
                setDirty(true);
                setTeacher({ ...teacher, notes: event.target.value });
              }}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="size-4 text-primary" />
            Bibliografía
          </CardTitle>
          <CardDescription>
            {bibliography.length === 0 ? "El sílabo no incluía bibliografía." : "Quita lo que no corresponda."}
          </CardDescription>
        </CardHeader>
        {bibliography.length > 0 ? (
          <CardContent>
            <ul className="grid gap-2">
              {bibliography.map((item, index) => (
                <li key={`${item.citation}-${index}`} className="flex items-start gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {item.citation}
                    {item.kind ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({item.kind === "basic" ? "básica" : "complementaria"})
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar referencia"
                    onClick={() => {
                      setDirty(true);
                      setBibliography((current) => current.filter((_, i) => i !== index));
                    }}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur md:bottom-4 md:p-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmDiscard(true)}
          disabled={saving || discarding}
        >
          Descartar
        </Button>
        <p className="ml-auto hidden text-sm text-muted-foreground lg:block">Nada se guarda hasta que confirmes.</p>
        <Button
          type="button"
          size="lg"
          onClick={save}
          disabled={saving || discarding}
          className="flex-1 sm:flex-none"
        >
          {saving ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          Confirmar y guardar
        </Button>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este sílabo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará lo extraído y el archivo subido. Podrás subir otro archivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir revisando</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={discard}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
