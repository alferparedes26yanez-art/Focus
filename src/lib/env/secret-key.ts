// Detects the most common setup mistake: pasting the publishable / "anon" key
// where the secret / "service_role" key goes. Requests then run as the anon
// role and fail with "permission denied". Never returns the key itself.
export function describeSecretKeyProblem(key: string): string | null {
  if (key.startsWith("sb_secret_")) return null;
  if (key.startsWith("sb_publishable_")) return "contiene la clave publicable (sb_publishable_...)";

  const parts = key.split(".");
  if (parts.length === 3) {
    // Legacy keys are JWTs; the role is in the payload.
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
      return payload.role === "service_role" ? null : `es la clave "${String(payload.role)}", no la "service_role"`;
    } catch {
      return "no es una clave de Supabase válida";
    }
  }
  return "no es una clave de Supabase válida";
}
