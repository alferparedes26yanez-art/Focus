import "server-only";

import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentResponse,
  type Part,
  type ThinkingConfig,
} from "@google/genai";
import { z } from "zod";

import { getAiEnv } from "@/lib/env/server";

import { assertWithinBudget } from "./budget";
import { AiError, busyError, invalidOutputError, notConfiguredError, requestFailedError } from "./errors";
import type { AiFeature } from "./features";
import { ConcurrencyLimiter } from "./limiter";
import { getErrorStatus, getRetryDelayMs, isRetryableError, RETRY_DELAYS_MS } from "./retry";
import { recordUsage } from "./usage";

// The only way the app talks to Gemini. Every call goes through here so that
// it respects the monthly budget, retries rate limits with backoff, waits its
// turn in the queue and is recorded in ai_usage.

export type ModelTier = "main" | "fast" | "deep";

const MAX_CONCURRENT_CALLS = 2;
const MAX_CALL_MS = 45_000;
const MIN_CALL_MS = 8_000;

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_CALLS);
let genai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genai) {
    genai = new GoogleGenAI({ apiKey: getAiEnv().GEMINI_API_KEY });
  }
  return genai;
}

export function getModel(tier: ModelTier): string {
  let env;
  try {
    env = getAiEnv();
  } catch (error) {
    throw notConfiguredError(error);
  }
  const model = {
    main: env.AI_MODEL_MAIN,
    fast: env.AI_MODEL_FAST,
    deep: env.AI_MODEL_DEEP,
  }[tier];
  if (!model) {
    throw notConfiguredError(new Error(`Missing model for tier "${tier}"`));
  }
  return model;
}

// Gemini 2.5 uses a token budget for thinking; Gemini 3+ uses levels.
function getThinkingConfig(model: string, effort: "low" | "default"): ThinkingConfig | undefined {
  if (effort === "default") return undefined;
  if (/^gemini-2\.5-/.test(model)) {
    return { thinkingBudget: model.includes("pro") ? 1024 : 512 };
  }
  if (/^gemini-[3-9]/.test(model)) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readUsage(response: GenerateContentResponse) {
  const usage = response.usageMetadata;
  return {
    inputTokens: (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0),
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
  };
}

type CallContext = {
  feature: AiFeature;
  userId: string;
  model: string;
  deadline: number;
};

async function callWithRetry(
  context: CallContext,
  request: (timeoutMs: number) => Promise<GenerateContentResponse>,
): Promise<GenerateContentResponse> {
  for (let attempt = 0; ; attempt++) {
    const timeoutMs = Math.min(MAX_CALL_MS, context.deadline - Date.now());
    if (timeoutMs < MIN_CALL_MS) {
      throw busyError(new Error("Deadline reached before the AI call could run"));
    }

    const startedAt = Date.now();
    try {
      const response = await request(timeoutMs);
      await recordUsage({
        userId: context.userId,
        feature: context.feature,
        model: context.model,
        ...readUsage(response),
        status: "success",
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      const status = getErrorStatus(error);
      await recordUsage({
        userId: context.userId,
        feature: context.feature,
        model: context.model,
        inputTokens: 0,
        outputTokens: 0,
        status: "error",
        errorCode: status ? `http_${status}` : error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - startedAt,
      });

      const retryable = isRetryableError(error);
      const delay = getRetryDelayMs(attempt, error);
      const canWait = Date.now() + delay + MIN_CALL_MS < context.deadline;
      if (retryable && attempt < RETRY_DELAYS_MS.length && canWait) {
        console.warn(`[ai] ${context.feature}: ${status ?? "network"} error, retry in ${delay} ms`);
        await sleep(delay);
        continue;
      }

      console.error(`[ai] ${context.feature} failed:`, error);
      if (retryable) throw busyError(error);
      const message = error instanceof Error ? error.message : "";
      if (status === 401 || status === 403 || status === 404 || /API key not valid/i.test(message)) {
        // Bad key or unknown model name.
        throw notConfiguredError(error);
      }
      throw requestFailedError(error);
    }
  }
}

function toResponseSchema(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

function summarizeIssues(error: z.ZodError) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export type GenerateJsonOptions<T extends z.ZodType> = {
  feature: AiFeature;
  tier: ModelTier;
  userId: string;
  schema: T;
  systemInstruction: string;
  parts: Part[];
  thinking?: "low" | "default";
  maxOutputTokens?: number;
  /** Epoch ms by which the whole operation must finish (serverless timeout). */
  deadline: number;
};

// Asks the model for JSON matching `schema` and validates it with zod. If the
// answer does not validate, asks once more telling the model what was wrong.
export async function generateJson<T extends z.ZodType>(
  options: GenerateJsonOptions<T>,
): Promise<z.infer<T>> {
  const model = getModel(options.tier);
  try {
    await assertWithinBudget();
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw requestFailedError(error);
  }

  const context: CallContext = {
    feature: options.feature,
    userId: options.userId,
    model,
    deadline: options.deadline,
  };
  const responseJsonSchema = toResponseSchema(options.schema);
  let maxOutputTokens = options.maxOutputTokens ?? 8_192;
  let repairNote: string | null = null;
  // If the API ever rejects the schema itself, fall back to describing it in
  // the prompt; the answer is still validated with zod below.
  let schemaInPrompt = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const parts: Part[] = [
      ...options.parts,
      ...(schemaInPrompt
        ? [{ text: `Answer only with JSON matching this JSON Schema:\n${JSON.stringify(responseJsonSchema)}` }]
        : []),
      ...(repairNote ? [{ text: repairNote }] : []),
    ];

    let response: GenerateContentResponse;
    try {
      response = await limiter.run(() =>
        callWithRetry(context, (timeoutMs) =>
          getGenAI().models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction: options.systemInstruction,
              responseMimeType: "application/json",
              responseJsonSchema: schemaInPrompt ? undefined : responseJsonSchema,
              maxOutputTokens,
              temperature: 0.2,
              thinkingConfig: getThinkingConfig(model, options.thinking ?? "low"),
              httpOptions: { timeout: timeoutMs },
            },
          }),
        ),
      );
    } catch (error) {
      const rejected =
        error instanceof AiError && error.code === "request_failed" && getErrorStatus(error.cause) === 400;
      if (rejected && !schemaInPrompt) {
        console.warn(`[ai] ${options.feature}: request rejected, retrying with the schema in the prompt`);
        schemaInPrompt = true;
        attempt--;
        continue;
      }
      throw error;
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      maxOutputTokens *= 2;
      repairNote = "Your previous answer was cut off. Answer again, more concisely, following the schema.";
      continue;
    }

    const text = response.text;
    if (!text) {
      repairNote = "Your previous answer was empty. Answer with JSON following the schema.";
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      repairNote = "Your previous answer was not valid JSON. Answer again following the schema exactly.";
      continue;
    }

    const parsed = options.schema.safeParse(json);
    if (parsed.success) {
      return parsed.data;
    }
    repairNote = `Your previous answer did not match the schema (${summarizeIssues(parsed.error)}). Answer again following the schema exactly.`;
  }

  throw invalidOutputError(new Error(repairNote ?? "Invalid output"));
}
