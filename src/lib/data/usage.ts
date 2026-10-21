import "server-only";

import { getBudgetStatus, getMonthWindow } from "@/lib/ai/budget";
import { getModelPrice } from "@/lib/ai/pricing";
import { requireUser } from "@/lib/auth";

export async function getAiUsageOverview() {
  const { supabase } = await requireUser();
  const now = new Date();
  const { start } = getMonthWindow(now);

  const [budget, summary] = await Promise.all([
    getBudgetStatus(now),
    supabase.rpc("my_ai_usage_summary", { p_since: start.toISOString() }),
  ]);
  if (summary.error) throw new Error(summary.error.message);

  const rows = summary.data.map((row) => ({
    feature: row.feature,
    model: row.model,
    calls: Number(row.calls),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    costUsd: Number(row.cost_usd),
    priceKnown: getModelPrice(row.model).known,
  }));

  return { budget, rows };
}
