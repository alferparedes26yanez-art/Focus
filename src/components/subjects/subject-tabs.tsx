"use client";

import { CalendarDays, ListTree } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Phase 1 tabs. Material, Chat, Estudiar and Progreso arrive in later phases.
export function SubjectTabs({
  defaultTab,
  eventCount,
  topics,
  events,
}: {
  defaultTab: "temas" | "evaluaciones";
  eventCount: number;
  topics: React.ReactNode;
  events: React.ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="temas">
          <ListTree />
          Temas
        </TabsTrigger>
        <TabsTrigger value="evaluaciones">
          <CalendarDays />
          Evaluaciones
          {eventCount > 0 ? (
            <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
              {eventCount}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="temas">{topics}</TabsContent>
      <TabsContent value="evaluaciones">{events}</TabsContent>
    </Tabs>
  );
}
