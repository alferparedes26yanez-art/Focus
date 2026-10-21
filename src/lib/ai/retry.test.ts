import { describe, expect, it } from "vitest";

import { getRetryDelayMs, getSuggestedDelayMs, isRetryableError } from "./retry";

function apiError(status: number, message = "error") {
  return Object.assign(new Error(message), { status });
}

describe("isRetryableError", () => {
  it("retries rate limits and transient server errors", () => {
    expect(isRetryableError(apiError(429))).toBe(true);
    expect(isRetryableError(apiError(503))).toBe(true);
    expect(isRetryableError(new TypeError("fetch failed"))).toBe(true);
  });

  it("does not retry client errors", () => {
    expect(isRetryableError(apiError(400))).toBe(false);
    expect(isRetryableError(apiError(403))).toBe(false);
  });
});

describe("getRetryDelayMs", () => {
  it("grows exponentially with up to 25 % jitter", () => {
    expect(getRetryDelayMs(0, apiError(429), () => 0)).toBe(2_000);
    expect(getRetryDelayMs(1, apiError(429), () => 0)).toBe(4_000);
    expect(getRetryDelayMs(2, apiError(429), () => 1)).toBe(10_000);
  });

  it("honors the delay suggested by a 429 response", () => {
    const error = apiError(429, '{"error":{"code":429,"details":[{"retryDelay":"21s"}]}}');
    expect(getSuggestedDelayMs(error)).toBe(21_000);
    expect(getRetryDelayMs(0, error, () => 0)).toBe(21_000);
  });
});
