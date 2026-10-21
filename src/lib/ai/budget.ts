import "server-only";

import { getAiEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { budgetExceededError } from "./errors";

// The budget is global (every call is billed to the same Gemini key) and
// resets on the first day of each calendar month (UTC).

export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetLevel = "ok" | "warning" | "blocked";

export type BudgetStatus = {
  spentUsd: number;
  budgetUsd: number;
  ratio: number;
  level: BudgetLevel;
  resetsAt: Date;
};

export function getMonthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resetsAt };
}

export function getBudgetLevel(ratio: number): BudgetLevel {
  if (ratio >= 1) return "blocked";
  if (ratio >= BUDGET_WARNING_RATIO) return "warning";
  return "ok";
}

export async function getBudgetStatus(now = new Date()): Promise<BudgetStatus> {
  const { AI_MONTHLY_BUDGET_USD: budgetUsd } = getAiEnv();
  const { start, resetsAt } = getMonthWindow(now);

  const { data, error } = await createAdminClient().rpc("ai_spend_since", {
    p_since: start.toISOString(),
  });
  if (error) {
    throw new Error(`No se pudo leer el consumo de IA: ${error.message}`);
  }

  const spentUsd = Number(data ?? 0);
  const ratio = spentUsd / budgetUsd;
  return { spentUsd, budgetUsd, ratio, level: getBudgetLevel(ratio), resetsAt };
}

export async function assertWithinBudget(): Promise<BudgetStatus> {
  const status = await getBudgetStatus();
  if (status.level === "blocked") {
    throw budgetExceededError(status.budgetUsd, status.resetsAt);
  }
  return status;
}
