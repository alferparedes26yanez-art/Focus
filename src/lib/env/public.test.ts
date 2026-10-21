import { describe, expect, it } from "vitest";

import { describeSupabaseUrlProblem } from "./public";

describe("describeSupabaseUrlProblem", () => {
  it("accepts a Supabase project URL", () => {
    expect(describeSupabaseUrlProblem("https://abcd.supabase.co", "https://focuss-alpha.vercel.app")).toBeNull();
    expect(describeSupabaseUrlProblem("http://127.0.0.1:54321", "http://localhost:3000")).toBeNull();
  });

  it("rejects the app's own address", () => {
    expect(describeSupabaseUrlProblem("https://focuss-alpha.vercel.app", undefined)).toContain("Vercel");
    expect(describeSupabaseUrlProblem("https://focus.example.com", "https://focus.example.com/")).toContain(
      "dirección de la app",
    );
    expect(describeSupabaseUrlProblem("emmtgx.supabase.co", undefined)).toContain("no es una URL");
  });
});
