import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import type { AiFeature } from "./features";
import { estimateCostUsd } from "./pricing";

export type UsageRecord = {
  userId: string;
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  status: "success" | "error";
  errorCode?: string;
  durationMs: number;
};

// Records one AI call. Never throws: a logging problem must not break the
// feature, but it is reported in the server logs.
export async function recordUsage(record: UsageRecord): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("ai_usage")
      .insert({
        user_id: record.userId,
        feature: record.feature,
        model: record.model,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        cost_usd: estimateCostUsd(record.model, record.inputTokens, record.outputTokens),
        status: record.status,
        error_code: record.errorCode?.slice(0, 100) ?? null,
        duration_ms: Math.max(0, Math.round(record.durationMs)),
      });
    if (error) {
      console.error("[ai_usage] insert failed:", error.message);
    }
  } catch (error) {
    console.error("[ai_usage] insert failed:", error);
  }
}
