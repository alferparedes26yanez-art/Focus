import { Info, Sparkles } from "lucide-react";
import { connection } from "next/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getFeatureLabel } from "@/lib/ai/features";
import { getAiUsageOverview } from "@/lib/data/usage";
import { cn } from "@/lib/utils";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const integer = new Intl.NumberFormat("es");
const dayMonth = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "UTC" });

export async function AiUsageCard() {
  await connection();

  let overview;
  try {
    overview = await getAiUsageOverview();
  } catch (error) {
    console.error("[settings] AI usage unavailable:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Consumo de IA</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Info />
            <AlertDescription>
              No se pudo leer el consumo. Revisa que SUPABASE_SECRET_KEY y las variables de IA estén configuradas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { budget, rows } = overview;
  const percent = Math.min(100, Math.round(budget.ratio * 100));
  const unknownPrices = rows.filter((row) => !row.priceKnown).map((row) => row.model);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          Consumo de IA este mes
        </CardTitle>
        <CardDescription>Gasto estimado de toda la app frente al presupuesto mensual.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tabular-nums">{usd.format(budget.spentUsd)}</span>
            <span className="text-sm text-muted-foreground">de {usd.format(budget.budgetUsd)}</span>
          </div>
          <Progress
            value={percent}
            aria-label={`${percent} % del presupuesto usado`}
            indicatorClassName={cn(
              budget.level === "warning" && "bg-amber-500",
              budget.level === "blocked" && "bg-destructive",
            )}
          />
          <p className="text-xs text-muted-foreground">
            {percent} % usado · se reinicia el {dayMonth.format(budget.resetsAt)}. Al 80 % verás un aviso; al 100 % la
            IA se pausa hasta el mes siguiente.
          </p>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Tu uso por función</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no usaste la IA este mes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Función</th>
                    <th className="py-1.5 pr-3 font-medium">Modelo</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Llamadas</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Tokens</th>
                    <th className="py-1.5 text-right font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.feature}-${row.model}`} className="border-t">
                      <td className="py-2 pr-3">{getFeatureLabel(row.feature)}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{row.model}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{integer.format(row.calls)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {integer.format(row.inputTokens + row.outputTokens)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{usd.format(row.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {unknownPrices.length > 0 ? (
          <Alert variant="warning">
            <Info />
            <AlertDescription className="text-warning-foreground">
              No hay precio registrado para {unknownPrices.join(", ")}: se estima con la tarifa más alta conocida.
              Agrégalo en src/lib/ai/pricing.ts.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
