import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { HomeSkeleton } from "@/components/home/home-skeleton";
import { SubjectCard } from "@/components/home/subject-card";
import { UpcomingEvents } from "@/components/home/upcoming-events";
import { EmptyState } from "@/components/shared/empty-state";
import { NewSubjectButton, NewSubjectCard } from "@/components/subjects/new-subject-button";
import { getProfile, getSubjectsOverview, getUpcomingEvents, type UpcomingEvent } from "@/lib/data/subjects";
import { formatToday } from "@/lib/dates";

export const metadata: Metadata = { title: "Inicio" };

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const profile = await getProfile();
  const [subjects, upcoming] = await Promise.all([
    getSubjectsOverview(),
    getUpcomingEvents(profile.today, 60),
  ]);

  if (subjects.length === 0 && !profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  const nextBySubject = new Map<string, UpcomingEvent>();
  for (const event of upcoming) {
    if (!nextBySubject.has(event.subject.id)) nextBySubject.set(event.subject.id, event);
  }
  const firstName = profile.fullName?.split(" ")[0];

  return (
    <div className="grid gap-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{formatToday(profile.timezone)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? `Hola, ${firstName}` : "Hola"}</h1>
      </header>

      <section className="grid gap-3" aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="text-lg font-semibold">
          Próximos exámenes y entregas
        </h2>
        <UpcomingEvents events={upcoming.slice(0, 5)} today={profile.today} />
      </section>

      <section className="grid gap-3" aria-labelledby="subjects-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="subjects-title" className="text-lg font-semibold">
            Mis materias
          </h2>
          {subjects.length > 0 ? <NewSubjectButton variant="outline" size="sm" className="hidden md:inline-flex" /> : null}
        </div>
        {subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Aún no tienes materias"
            description="Crea una materia y sube su sílabo: Focus la organiza en unidades, temas y fechas."
            action={<NewSubjectButton>Crear mi primera materia</NewSubjectButton>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                nextEvent={nextBySubject.get(subject.id) ?? null}
                today={profile.today}
              />
            ))}
            <NewSubjectCard />
          </div>
        )}
      </section>
    </div>
  );
}
