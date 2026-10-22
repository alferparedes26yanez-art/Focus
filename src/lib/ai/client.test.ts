import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  recordUsage: vi.fn<(usage: { model: string; status: string }) => Promise<void>>(async () => {}),
}));

vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
  },
}));
vi.mock("@/lib/env/server", () => ({
  getAiEnv: () => ({
    GEMINI_API_KEY: "test",
    AI_MODEL_MAIN: "gemini-main",
    AI_MODEL_FAST: "gemini-lite",
    AI_MODEL_DEEP: undefined,
    AI_MODEL_EMBEDDING: "gemini-embedding",
    AI_MONTHLY_BUDGET_USD: 9,
  }),
}));
vi.mock("./budget", () => ({ assertWithinBudget: async () => ({}) }));
vi.mock("./usage", () => ({ recordUsage: mocks.recordUsage }));

import { generateJson } from "./client";

const overloaded = () => Object.assign(new Error('{"error":{"code":503,"message":"The model is overloaded."}}'), { status: 503 });
const ok = (text: string) => ({ text, candidates: [{ finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });

const run = (tier: "main" | "fast") =>
  generateJson({
    feature: "syllabus_extraction",
    tier,
    userId: "u1",
    schema: z.object({ ok: z.boolean() }),
    systemInstruction: "test",
    parts: [{ text: "hola" }],
    deadline: Date.now() + 55_000,
  });

beforeEach(() => {
  vi.useFakeTimers();
  mocks.generateContent.mockReset();
  mocks.recordUsage.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("generateJson", () => {
  it("moves to the light model when the main one is overloaded", async () => {
    mocks.generateContent.mockRejectedValueOnce(overloaded()).mockResolvedValueOnce(ok('{"ok":true}'));
    const result = run("main");
    await vi.runAllTimersAsync();

    expect(await result).toEqual({ ok: true });
    expect(mocks.generateContent.mock.calls.map(([request]) => request.model)).toEqual(["gemini-main", "gemini-lite"]);
    expect(mocks.recordUsage.mock.calls.map(([usage]) => [usage.model, usage.status])).toEqual([
      ["gemini-main", "error"],
      ["gemini-lite", "success"],
    ]);
  });

  it("keeps the same model for rate limits (429)", async () => {
    mocks.generateContent
      .mockRejectedValueOnce(Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }))
      .mockResolvedValueOnce(ok('{"ok":true}'));
    const result = run("main");
    await vi.runAllTimersAsync();

    expect(await result).toEqual({ ok: true });
    expect(mocks.generateContent.mock.calls.map(([request]) => request.model)).toEqual(["gemini-main", "gemini-main"]);
  });

  it("has nothing lighter to move to from the light model", async () => {
    mocks.generateContent.mockRejectedValueOnce(overloaded()).mockResolvedValueOnce(ok('{"ok":true}'));
    const result = run("fast");
    await vi.runAllTimersAsync();

    expect(await result).toEqual({ ok: true });
    expect(mocks.generateContent.mock.calls.map(([request]) => request.model)).toEqual(["gemini-lite", "gemini-lite"]);
  });
});
