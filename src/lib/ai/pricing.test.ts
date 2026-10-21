import { describe, expect, it } from "vitest";

import { estimateCostUsd, getModelPrice, MODEL_PRICES } from "./pricing";

describe("getModelPrice", () => {
  it("uses the longest matching prefix", () => {
    expect(getModelPrice("gemini-2.5-flash-lite").price).toEqual(MODEL_PRICES["gemini-2.5-flash-lite"]);
    expect(getModelPrice("gemini-2.5-flash").price).toEqual(MODEL_PRICES["gemini-2.5-flash"]);
    expect(getModelPrice("gemini-3.1-flash-lite-preview").price).toEqual(MODEL_PRICES["gemini-3.1-flash-lite"]);
  });

  it("does not confuse similar names", () => {
    // "gemini-3.5-flash" must not match "gemini-3.5-flashy".
    expect(getModelPrice("gemini-3.5-flashy").known).toBe(false);
  });

  it("estimates unknown models with the most expensive price", () => {
    const { price, known } = getModelPrice("some-new-model");
    expect(known).toBe(false);
    expect(price.output).toBe(Math.max(...Object.values(MODEL_PRICES).map((p) => p.output)));
  });
});

describe("estimateCostUsd", () => {
  it("charges input and output (thinking included) per million tokens", () => {
    // 10,000 input * 0.30 + 2,000 output * 2.50 = 0.003 + 0.005
    expect(estimateCostUsd("gemini-2.5-flash", 10_000, 2_000)).toBeCloseTo(0.008, 6);
  });
});
