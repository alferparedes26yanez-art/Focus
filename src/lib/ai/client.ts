import "server-only";

import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentResponse,
  type MediaResolution,
  type Part,
  type ThinkingConfig,
} from "@google/genai";
import { z } from "zod";

import { ConfigError } from "@/lib/env/config-error";
import { getAiEnv } from "@/lib/env/server";

import { assertWithinBudget } from "./budget";
import { AiError, busyError, invalidOutputError, notConfiguredError, requestFailedError } from "./errors";
import type { AiFeature } from "./features";
import { ConcurrencyLimiter } from "./limiter";
import { getErrorStatus, getRetryDelayMs, isRetryableError, RETRY_DELAYS_MS } from "./retry";
import { describeGeminiSetupError, MODEL_ENV_NAMES, type ModelTier } from "./setup-errors";
import { recordUsage } from "./usage";

// The only way the app talks to Gemini. Every call goes through here so that
// it respects the monthly budget, retries rate limits with backoff, waits its
// turn in the queue and is recorded in ai_usage.

export type { ModelTier };

/** Size of every embedding stored in chunks.embedding (vector(768)). */
export const EMBEDDING_DIMENSIONS = 768;

const MAX_CONCURRENT_CALLS = 2;
const MAX_CALL_MS = 45_000;
const MIN_CALL_MS = 8_000;
const EMBED_BATCH_SIZE = 50;

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
    throw notConfiguredError(error instanceof ConfigError ? error.message : undefined, error);
  }
  const model = {
    main: env.AI_MODEL_MAIN,
    // Simple tasks fall back to the main model if no Flash-Lite is set.
    fast: env.AI_MODEL_FAST ?? env.AI_MODEL_MAIN,
    deep: env.AI_MODEL_DEEP,
    embedding: env.AI_MODEL_EMBEDDING,
  }[tier];
  if (!model) {
    throw notConfiguredError(`falta la variable ${MODEL_ENV_NAMES[tier]}.`);
  }
  return model;
}

// When a model is overloaded (503), the call moves to a lighter one so the
// student is not left waiting: Pro → main, main → Flash-Lite.
function getFallbackModel(tier: ModelTier, model: string): string | undefined {
  if (tier !== "main" && tier !== "deep") return undefined;
  const env = getAiEnv();
  const fallback = tier === "deep" ? env.AI_MODEL_MAIN : env.AI_MODEL_FAST;
  return fallback && fallback !== model ? fallback : undefined;
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

// When a model is not found, ask the API which models this key can use so the
// error message can name valid ones. Flash models first.
async function listAvailableModels(action: "generateContent" | "embedContent"): Promise<string[]> {
  try {
    const pager = await getGenAI().models.list({ config: { pageSize: 100, queryBase: true } });
    const names: string[] = [];
    for await (const model of pager) {
      const id = model.name?.replace(/^models\//, "");
      const isText = action === "embedContent" || !/tts|image|audio|live|embedding|robotics|computer/.test(id ?? "");
      if (id && id.startsWith("gemini-") && (model.supportedActions ?? []).includes(action) && isText) {
        names.push(id);
      }
    }
    return names.sort((a, b) => Number(b.includes("flash")) - Number(a.includes("flash"))).slice(0, 8);
  } catch (error) {
    console.error("[ai] could not list models:", error);
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Usage = { inputTokens: number; outputTokens: number };

function readUsage(response: GenerateContentResponse): Usage {
  const usage = response.usageMetadata;
  return {
    inputTokens: (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0),
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
  };
}

type CallContext = {
  feature: AiFeature;
  userId: string;
  tier: ModelTier;
  model: string;
  deadline: number;
  fallbackModel?: string;
};

async function ensureBudget() {
  try {
    await assertWithinBudget();
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw requestFailedError(error);
  }
}

// Runs one API request with retries. `usageOf` returns what to record when it
// succeeds, or null when the caller records it later (streams). `request`
// receives the model to use, which changes if the first one is overloaded.
async function callWithRetry<T>(
  context: CallContext,
  request: (timeoutMs: number, model: string) => Promise<T>,
  usageOf: (response: T, model: string) => Usage | null,
): Promise<T> {
  let model = context.model;
  for (let attempt = 0; ; attempt++) {
    const timeoutMs = Math.min(MAX_CALL_MS, context.deadline - Date.now());
    if (timeoutMs < MIN_CALL_MS) {
      throw busyError(new Error("Deadline reached before the AI call could run"));
    }

    const startedAt = Date.now();
    try {
      const response = await request(timeoutMs, model);
      const usage = usageOf(response, model);
      if (usage) {
        await recordUsage({
          userId: context.userId,
          feature: context.feature,
          model,
          ...usage,
          status: "success",
          durationMs: Date.now() - startedAt,
        });
      }
      return response;
    } catch (error) {
      const status = getErrorStatus(error);
      await recordUsage({
        userId: context.userId,
        feature: context.feature,
        model,
        inputTokens: 0,
        outputTokens: 0,
        status: "error",
        errorCode: status ? `http_${status}` : error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - startedAt,
      });

      if (status === 503 && context.fallbackModel && model !== context.fallbackModel) {
        console.warn(`[ai] ${context.feature}: ${model} is overloaded, using ${context.fallbackModel}`);
        model = context.fallbackModel;
      }

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
      const setupProblem = describeGeminiSetupError(status, message, model, context.tier);
      if (setupProblem) {
        const available =
          status === 404
            ? await listAvailableModels(context.tier === "embedding" ? "embedContent" : "generateContent")
            : [];
        if (available.length > 0) console.warn("[ai] models available for this key:", available.join(", "));
        throw notConfiguredError(
          available.length > 0 ? `${setupProblem} Modelos disponibles: ${available.join(", ")}.` : setupProblem,
          error,
        );
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
  /** Lower image/video resolution to save tokens (transcripts). */
  mediaResolution?: MediaResolution;
  /** Epoch ms by which the whole operation must finish (serverless timeout). */
  deadline: number;
};

// Asks the model for JSON matching `schema` and validates it with zod. If the
// answer does not validate, asks once more telling the model what was wrong.
export async function generateJson<T extends z.ZodType>(
  options: GenerateJsonOptions<T>,
): Promise<z.infer<T>> {
  const model = getModel(options.tier);
  await ensureBudget();

  const context: CallContext = {
    feature: options.feature,
    userId: options.userId,
    tier: options.tier,
    model,
    deadline: options.deadline,
    fallbackModel: getFallbackModel(options.tier, model),
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
        callWithRetry(
          context,
          (timeoutMs, activeModel) =>
            getGenAI().models.generateContent({
              model: activeModel,
              contents: [{ role: "user", parts }],
              config: {
                systemInstruction: options.systemInstruction,
                responseMimeType: "application/json",
                responseJsonSchema: schemaInPrompt ? undefined : responseJsonSchema,
                maxOutputTokens,
                temperature: 0.2,
                thinkingConfig: getThinkingConfig(activeModel, options.thinking ?? "low"),
                mediaResolution: options.mediaResolution,
                httpOptions: { timeout: timeoutMs },
              },
            }),
          readUsage,
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

// Embeddings for the search index ("document") or for a question ("query").
export async function embedTexts(options: {
  feature: AiFeature;
  userId: string;
  texts: string[];
  purpose: "document" | "query";
  deadline: number;
}): Promise<number[][]> {
  if (options.texts.length === 0) return [];
  const model = getModel("embedding");
  await ensureBudget();

  const context: CallContext = {
    feature: options.feature,
    userId: options.userId,
    tier: "embedding",
    model,
    deadline: options.deadline,
  };

  const vectors: number[][] = [];
  for (let start = 0; start < options.texts.length; start += EMBED_BATCH_SIZE) {
    const batch = options.texts.slice(start, start + EMBED_BATCH_SIZE);
    // The embeddings API does not report tokens; ~4 characters per token.
    const estimatedTokens = Math.ceil(batch.reduce((sum, text) => sum + text.length, 0) / 4);
    const response = await limiter.run(() =>
      callWithRetry(
        context,
        (timeoutMs, activeModel) =>
          getGenAI().models.embedContent({
            model: activeModel,
            contents: batch,
            config: {
              taskType: options.purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
              outputDimensionality: EMBEDDING_DIMENSIONS,
              httpOptions: { timeout: timeoutMs },
            },
          }),
        () => ({ inputTokens: estimatedTokens, outputTokens: 0 }),
      ),
    );
    const values = (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    if (values.length !== batch.length || values.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw invalidOutputError(new Error("Unexpected embedding size"));
    }
    vectors.push(...values);
  }
  return vectors;
}

// Streams a text answer (chat). Retries only while opening the stream; usage
// is recorded when the stream ends.
export async function streamText(options: {
  feature: AiFeature;
  tier: ModelTier;
  userId: string;
  systemInstruction: string;
  contents: Content[];
  maxOutputTokens?: number;
  deadline: number;
}): Promise<AsyncGenerator<string>> {
  const model = getModel(options.tier);
  await ensureBudget();

  const context: CallContext = {
    feature: options.feature,
    userId: options.userId,
    tier: options.tier,
    model,
    deadline: options.deadline,
    fallbackModel: getFallbackModel(options.tier, model),
  };
  const startedAt = Date.now();
  let usedModel = model;
  const stream = await limiter.run(() =>
    callWithRetry(
      context,
      (timeoutMs, activeModel) => {
        usedModel = activeModel;
        return getGenAI().models.generateContentStream({
          model: activeModel,
          contents: options.contents,
          config: {
            systemInstruction: options.systemInstruction,
            maxOutputTokens: options.maxOutputTokens ?? 4_096,
            temperature: 0.3,
            thinkingConfig: getThinkingConfig(activeModel, "low"),
            httpOptions: { timeout: timeoutMs },
          },
        });
      },
      () => null,
    ),
  );

  return (async function* () {
    let last: GenerateContentResponse | undefined;
    let failed = false;
    try {
      for await (const chunk of stream) {
        last = chunk;
        const text = chunk.text;
        if (text) yield text;
      }
    } catch (error) {
      failed = true;
      console.error(`[ai] ${options.feature} stream failed:`, error);
      throw requestFailedError(error);
    } finally {
      await recordUsage({
        userId: options.userId,
        feature: options.feature,
        model: usedModel,
        ...(last ? readUsage(last) : { inputTokens: 0, outputTokens: 0 }),
        status: failed ? "error" : "success",
        durationMs: Date.now() - startedAt,
      });
    }
  })();
}
