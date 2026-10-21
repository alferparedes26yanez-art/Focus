"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-10">
      <ErrorState onRetry={retry} />
    </div>
  );
}
