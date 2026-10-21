import { Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { getBudgetStatus } from "@/lib/ai/budget";

const dayMonth = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "UTC" });

// Shown on every page once the month's AI spend reaches 80 % of the budget.
export async function BudgetBanner() {
  await connection();

  let status;
  try {
    status = await getBudgetStatus();
  } catch {
    return null; // Not configured yet; Settings explains what is missing.
  }
  if (status.level === "ok") return null;

  const blocked = status.level === "blocked";
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-8">
      <Alert variant={blocked ? "destructive" : "warning"}>
        {blocked ? <TriangleAlert /> : <Sparkles />}
        <AlertDescription className={blocked ? undefined : "text-warning-foreground"}>
          <p>
            {blocked
              ? `Se alcanzó el límite mensual de IA. Las funciones de IA vuelven el ${dayMonth.format(status.resetsAt)}; todo lo demás sigue funcionando.`
              : `Llevas el ${Math.round(status.ratio * 100)} % del presupuesto de IA de este mes.`}{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Ver consumo
            </Link>
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
