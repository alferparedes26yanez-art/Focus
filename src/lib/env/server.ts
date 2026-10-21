import "server-only";

import { z } from "zod";

// Server-only configuration. Parsed lazily so `next build` works without
// secrets; a missing value fails the first request that needs it.

const aiEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  AI_MODEL_MAIN: z.string().min(1),
  AI_MODEL_FAST: z.string().min(1).optional(),
  AI_MODEL_DEEP: z.string().min(1).optional(),
  AI_MODEL_EMBEDDING: z.string().min(1).optional(),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(9),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

function emptyToUndefined(value: string | undefined) {
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export function getAiEnv(): AiEnv {
  const parsed = aiEnvSchema.safeParse({
    GEMINI_API_KEY: emptyToUndefined(process.env.GEMINI_API_KEY),
    AI_MODEL_MAIN: emptyToUndefined(process.env.AI_MODEL_MAIN),
    AI_MODEL_FAST: emptyToUndefined(process.env.AI_MODEL_FAST),
    AI_MODEL_DEEP: emptyToUndefined(process.env.AI_MODEL_DEEP),
    AI_MODEL_EMBEDDING: emptyToUndefined(process.env.AI_MODEL_EMBEDDING),
    AI_MONTHLY_BUDGET_USD: emptyToUndefined(process.env.AI_MONTHLY_BUDGET_USD),
  });
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuración de IA incompleta o inválida: ${names}. Revisa .env.local.`);
  }
  return parsed.data;
}

export function getSupabaseSecretKey(): string {
  const key = emptyToUndefined(process.env.SUPABASE_SECRET_KEY);
  if (!key) {
    throw new Error("Falta la variable de entorno SUPABASE_SECRET_KEY. Revisa .env.local.");
  }
  return key;
}
