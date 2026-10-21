import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import { getSupabaseSecretKey } from "@/lib/env/server";
import type { Database } from "@/types/database";

// Bypasses RLS. Only for things users must not do themselves: writing
// ai_usage, reading the global AI spend and checking the signup allowlist.
export function createAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  return createClient<Database>(supabaseUrl, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
