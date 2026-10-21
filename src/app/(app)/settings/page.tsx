import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AiUsageCard } from "@/components/settings/ai-usage-card";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/actions/auth";
import { getProfile } from "@/lib/data/subjects";

export const metadata: Metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <Suspense fallback={<Skeleton className="h-72 rounded-xl" />}>
        <AiUsageCard />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <ProfileCard />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Modo claro, oscuro o el de tu dispositivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
        <AccountCard />
      </Suspense>
    </div>
  );
}

async function ProfileCard() {
  const profile = await getProfile();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
      </CardHeader>
      <CardContent>
        <ProfileForm
          fullName={profile.fullName}
          timezone={profile.timezone}
          timeZones={Intl.supportedValuesOf("timeZone")}
        />
      </CardContent>
    </Card>
  );
}

async function AccountCard() {
  const profile = await getProfile();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuenta</CardTitle>
        <CardDescription>{profile.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signOut}>
          <SubmitButton variant="outline" pendingText="Cerrando sesión…">
            <LogOut />
            Cerrar sesión
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
