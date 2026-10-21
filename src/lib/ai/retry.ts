// Backoff policy for Gemini calls: retry rate limits (429 RESOURCE_EXHAUSTED)
// and transient server errors with exponential delays plus jitter.

export const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000];

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export function getErrorStatus(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : null;
  }
  return null;
}

export function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null) {
    return RETRYABLE_STATUS.has(status);
  }
  // Network failures (fetch failed, socket reset, timeouts) have no status.
  if (error instanceof Error) {
    return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network|aborted|timeout/i.test(
      `${error.name} ${error.message}`,
    );
  }
  return false;
}

// Gemini 429 responses may say how long to wait, e.g. "retryDelay": "21s".
export function getSuggestedDelayMs(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/"?retryDelay"?\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}

export function getRetryDelayMs(attempt: number, error: unknown, random = Math.random): number {
  const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
  const jitter = Math.round(base * 0.25 * random());
  const suggested = getSuggestedDelayMs(error);
  return Math.max(base + jitter, suggested ?? 0);
}
