"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // Server errors carry a digest: the same code appears in the Vercel logs.
  const digest = typeof error === "object" && error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="grid gap-3 py-10">
      <ErrorState onRetry={retry} />
      {digest ? <p className="text-center text-xs text-muted-foreground">Código del error: {digest}</p> : null}
    </div>
  );
}
