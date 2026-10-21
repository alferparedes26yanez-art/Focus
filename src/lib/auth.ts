import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// Data access layer for the session. Every Server Action, Route Handler and data
// loader calls one of these instead of trusting anything from the client.

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return {
    supabase,
    userId: claims?.sub ?? null,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
});

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  return { supabase: session.supabase, userId: session.userId, email: session.email };
}
