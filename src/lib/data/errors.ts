// A table the code expects is not in the database yet: a migration was not
// applied. Pages catch it to explain what to run instead of failing.
export class MissingTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingTableError";
  }
}

// PGRST205: PostgREST does not know the table · 42P01: undefined table.
export function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table|relation .* does not exist/i.test(error.message ?? "")
  );
}

export function toDataError(error: { code?: string; message: string }): Error {
  return isMissingTable(error) ? new MissingTableError(error.message) : new Error(error.message);
}
