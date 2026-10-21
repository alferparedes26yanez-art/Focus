import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function safeNext(next: string | null): string | null {
  // Only same-site relative paths, never "//evil.com".
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

// Target of the links in confirmation and password-reset emails.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const type = OTP_TYPES.find((value) => value === rawType) ?? null;

  const supabase = await createClient();
  let failed = true;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (failed) {
    target.pathname = "/login";
    target.searchParams.set("error", "link");
  } else {
    target.pathname = type === "recovery" ? "/reset-password" : (next ?? "/home");
  }
  return NextResponse.redirect(target);
}
