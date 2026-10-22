import { DatabaseZap } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

// Shown instead of a feature whose tables are not in the database yet.
export function SetupNotice({ migrations }: { migrations: string[] }) {
  return (
    <EmptyState
      icon={DatabaseZap}
      title="Falta preparar la base de datos"
      description={`Para usar esta sección, ejecuta en Supabase → SQL Editor, en este orden: ${migrations.join(" y ")} (están en supabase/migrations). Después recarga la página.`}
    />
  );
}
