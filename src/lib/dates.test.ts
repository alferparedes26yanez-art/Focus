import { describe, expect, it } from "vitest";

import { daysUntil, relativeDayLabel, todayIn } from "./dates";

describe("todayIn", () => {
  it("uses the user's time zone, not the server's", () => {
    // 03:00 UTC on Oct 22 is still Oct 21 in Ecuador (UTC-5).
    const now = new Date("2026-10-22T03:00:00Z");
    expect(todayIn("America/Guayaquil", now)).toBe("2026-10-21");
    expect(todayIn("Europe/Madrid", now)).toBe("2026-10-22");
  });

  it("falls back to Ecuador for an invalid zone", () => {
    expect(todayIn("Mars/Base", new Date("2026-10-22T03:00:00Z"))).toBe("2026-10-21");
  });
});

describe("relative days", () => {
  it("counts calendar days without time zone shifts", () => {
    expect(daysUntil("2026-11-01", "2026-10-31")).toBe(1);
    expect(relativeDayLabel("2026-10-21", "2026-10-21")).toBe("Hoy");
    expect(relativeDayLabel("2026-10-22", "2026-10-21")).toBe("Mañana");
    expect(relativeDayLabel("2026-10-31", "2026-10-21")).toBe("En 10 días");
    expect(relativeDayLabel("2026-10-18", "2026-10-21")).toBe("Hace 3 días");
  });
});
