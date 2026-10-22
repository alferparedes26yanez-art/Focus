import { describe, expect, it } from "vitest";

import { isMissingTable, MissingTableError, toDataError } from "./errors";

describe("missing tables", () => {
  it("recognizes PostgREST and Postgres errors for tables that do not exist", () => {
    expect(isMissingTable({ code: "PGRST205", message: "Could not find the table 'public.materials' in the schema cache" })).toBe(true);
    expect(isMissingTable({ code: "42P01", message: 'relation "public.chat_threads" does not exist' })).toBe(true);
    expect(isMissingTable({ code: "42501", message: "permission denied for table materials" })).toBe(false);
  });

  it("keeps other errors as they are", () => {
    expect(toDataError({ code: "PGRST205", message: "x" })).toBeInstanceOf(MissingTableError);
    expect(toDataError({ code: "08006", message: "connection failure" })).not.toBeInstanceOf(MissingTableError);
  });
});
