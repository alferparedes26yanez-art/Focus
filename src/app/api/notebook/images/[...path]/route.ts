import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { NOTEBOOK_BUCKET } from "@/lib/notebook/document";

// Images in the notebook point here: the address stays the same in the saved
// page, and each view gets a short-lived link to the private file.
const LINK_SECONDS = 600;

export async function GET(_request: Request, context: RouteContext<"/api/notebook/images/[...path]">) {
  const { path: segments } = await context.params;
  const path = segments.map((segment) => decodeURIComponent(segment)).join("/");

  const { supabase, userId } = await getSession();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  if (!path.startsWith(`${userId}/`) || path.includes("..")) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage.from(NOTEBOOK_BUCKET).createSignedUrl(path, LINK_SECONDS);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "cache-control": `private, max-age=${LINK_SECONDS - 60}` },
  });
}
