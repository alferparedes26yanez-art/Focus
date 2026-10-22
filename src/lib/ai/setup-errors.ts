// Turns Gemini errors caused by configuration (bad key, unavailable model,
// API not enabled) into a message that says what to change. Returns null for
// any other error.

export type ModelTier = "main" | "fast" | "deep";

export const MODEL_ENV_NAMES: Record<ModelTier, string> = {
  main: "AI_MODEL_MAIN",
  fast: "AI_MODEL_FAST",
  deep: "AI_MODEL_DEEP",
};

const SUGGESTED_MODELS: Record<ModelTier, string> = {
  main: "gemini-3.8-flash",
  fast: "gemini-3.5-flash-lite",
  deep: "un modelo Pro vigente",
};

export function describeGeminiSetupError(
  status: number | null,
  message: string,
  model: string,
  tier: ModelTier,
): string | null {
  if (/API key not valid|API_KEY_INVALID/i.test(message)) {
    return "la clave de Gemini (GEMINI_API_KEY) no es válida. Cópiala de nuevo desde aistudio.google.com/apikey.";
  }
  if (status === 404) {
    return `el modelo "${model}" no está disponible para tu clave. Cambia ${MODEL_ENV_NAMES[tier]} (por ejemplo a ${SUGGESTED_MODELS[tier]}).`;
  }
  if (status === 401 || status === 403) {
    return "Gemini rechazó la clave (GEMINI_API_KEY). Revisa que sea del proyecto de Google con facturación activa y que la API de Gemini esté habilitada.";
  }
  return null;
}
