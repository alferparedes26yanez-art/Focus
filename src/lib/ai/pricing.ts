// Gemini API paid-tier prices in USD per 1M tokens (text/image/PDF input).
// Thinking tokens are billed as output.
// Source: https://ai.google.dev/gemini-api/docs/pricing — check it when you
// change a model in .env.local; prices change and these are estimates.
// Keys are model-id prefixes: the longest matching prefix wins, so
// "gemini-3.1-flash-lite-preview" uses the "gemini-3.1-flash-lite" row.

export type ModelPrice = { input: number; output: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.1-pro": { input: 2, output: 12 },
  "gemini-3-flash": { input: 0.5, output: 3 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

// Unknown models are estimated with the most expensive known price so the
// budget errs on the safe side.
const FALLBACK_PRICE: ModelPrice = Object.values(MODEL_PRICES).reduce(
  (max, price) => ({
    input: Math.max(max.input, price.input),
    output: Math.max(max.output, price.output),
  }),
  { input: 0, output: 0 },
);

export function getModelPrice(model: string): { price: ModelPrice; known: boolean } {
  const id = model.replace(/^models\//, "").toLowerCase();
  const prefix = Object.keys(MODEL_PRICES)
    .filter((key) => id === key || id.startsWith(`${key}-`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix
    ? { price: MODEL_PRICES[prefix], known: true }
    : { price: FALLBACK_PRICE, known: false };
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const { price } = getModelPrice(model);
  const cost = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
