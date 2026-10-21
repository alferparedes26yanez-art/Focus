import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Bienvenido" };

export default function OnboardingPage() {
  return (
    <div className="grid gap-6">
      <header className="mx-auto w-full max-w-2xl space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Focus</h1>
        <p className="text-muted-foreground">En tres pasos tendrás tu primera materia organizada.</p>
      </header>
      <OnboardingWizard />
    </div>
  );
}
