"use client";

import { CalendarDays, Library, ListTree, MessageCircle, NotebookPen } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SubjectTab } from "@/lib/constants/subject-tabs";


function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums max-sm:hidden">{value}</span>
  );
}

// Estudiar and Progreso arrive in later phases.
export function SubjectTabs({
  defaultTab,
  materialCount,
  eventCount,
  notebookCount,
  topics,
  materials,
  chat,
  events,
  notebook,
}: {
  defaultTab: SubjectTab;
  materialCount: number;
  eventCount: number;
  notebookCount: number;
  topics: React.ReactNode;
  materials: React.ReactNode;
  chat: React.ReactNode;
  events: React.ReactNode;
  notebook: React.ReactNode;
}) {
  // Keep the open tab in the address so a reload or a shared link opens it.
  const remember = (tab: string) => {
    const url = new URL(window.location.href);
    if (tab === "temas") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  };

  return (
    <Tabs defaultValue={defaultTab} onValueChange={remember} className="min-w-0">
      <TabsList className="w-full overflow-x-auto sm:w-fit">
        <TabsTrigger value="temas" className="max-sm:px-1 max-sm:text-[13px] max-sm:[&>svg]:hidden">
          <ListTree />
          Temas
        </TabsTrigger>
        <TabsTrigger value="material" className="max-sm:px-1 max-sm:text-[13px] max-sm:[&>svg]:hidden">
          <Library />
          Material
          <Count value={materialCount} />
        </TabsTrigger>
        <TabsTrigger value="chat" className="max-sm:px-1 max-sm:text-[13px] max-sm:[&>svg]:hidden">
          <MessageCircle />
          Chat
        </TabsTrigger>
        <TabsTrigger value="evaluaciones" className="max-sm:px-1 max-sm:text-[13px] max-sm:[&>svg]:hidden">
          <CalendarDays />
          Evaluaciones
          <Count value={eventCount} />
        </TabsTrigger>
        <TabsTrigger value="cuaderno" className="max-sm:px-1 max-sm:text-[13px] max-sm:[&>svg]:hidden">
          <NotebookPen />
          Cuaderno
          <Count value={notebookCount} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="temas">{topics}</TabsContent>
      <TabsContent value="material">{materials}</TabsContent>
      <TabsContent value="chat">{chat}</TabsContent>
      <TabsContent value="evaluaciones">{events}</TabsContent>
      <TabsContent value="cuaderno">{notebook}</TabsContent>
    </Tabs>
  );
}
