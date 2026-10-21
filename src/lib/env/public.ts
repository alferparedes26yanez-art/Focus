import { ConfigError } from "./config-error";

// Public configuration, safe in the browser. Every value must be referenced
// literally (process.env.NEXT_PUBLIC_...) so Next.js can inline it.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new ConfigError(`Falta la variable de entorno ${name}. Revisa .env.local o las variables de Vercel.`);
  }
  return value;
}

// Catches the most common setup mistake: the app's own address (Vercel) in
// NEXT_PUBLIC_SUPABASE_URL instead of the Supabase project URL.
export function describeSupabaseUrlProblem(url: string, siteUrl?: string): string | null {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return "no es una URL válida";
  }
  if (host.endsWith(".vercel.app")) return "tiene la dirección de la app en Vercel";
  try {
    if (siteUrl && new URL(siteUrl).host === host) return "tiene la dirección de la app";
  } catch {
    // An invalid site URL is reported by getSiteUrl.
  }
  return null;
}

export function getPublicEnv() {
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const problem = describeSupabaseUrlProblem(supabaseUrl, process.env.NEXT_PUBLIC_SITE_URL);
  if (problem) {
    throw new ConfigError(
      `NEXT_PUBLIC_SUPABASE_URL ${problem}: debe ser la de tu proyecto de Supabase (https://xxxx.supabase.co).`,
    );
  }
  return {
    supabaseUrl,
    supabasePublishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function getSiteUrl(): string {
  return required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "");
}
