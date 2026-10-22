"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type BatchResponse =
  | { ok: true; status: "processing" | "ready"; waiting: boolean }
  | { ok: false; retryable: boolean; sessionExpired?: boolean };

async function requestBatch(materialId: string): Promise<BatchResponse> {
  try {
    const response = await fetch(`/api/materials/${materialId}/process`, { method: "POST" });
    const body = (await response.json().catch(() => null)) as
      | { status?: "processing" | "ready"; waiting?: boolean; retryable?: boolean }
      | null;
    if (response.ok && body?.status) return { ok: true, status: body.status, waiting: body.waiting ?? false };
    if (response.status === 401) return { ok: false, retryable: false, sessionExpired: true };
    // 504: the function hit its time limit; the lock expires and it resumes.
    return { ok: false, retryable: body?.retryable ?? response.status >= 500 };
  } catch {
    return { ok: false, retryable: true };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const WAIT_WHEN_LOCKED_MS = 8_000;
const WAIT_WHEN_BUSY_MS = 30_000;

// Reads the subject's queued material one batch at a time while the page is
// open, and refreshes the page after each batch to show the progress. Several
// tabs can run it at once: the server lets only one work on each material.
export function MaterialProcessor({ pendingIds }: { pendingIds: string[] }) {
  const router = useRouter();
  const pending = useRef(pendingIds);
  // Materials to skip for now: until a time (busy) or until the page shows
  // their new state (finished or failed).
  const retryAt = useRef(new Map<string, number>());
  const settled = useRef(new Set<string>());
  const active = pendingIds.length > 0;

  useEffect(() => {
    pending.current = pendingIds;
    for (const id of settled.current) {
      if (!pendingIds.includes(id)) settled.current.delete(id);
    }
  }, [pendingIds]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;

    const loop = async () => {
      while (!stopped) {
        const now = Date.now();
        const candidates = pending.current.filter((id) => !settled.current.has(id));
        if (candidates.length === 0) {
          // Waiting for the refreshed page; new material may arrive meanwhile.
          await sleep(1_500);
          continue;
        }
        const id = candidates.find((candidate) => (retryAt.current.get(candidate) ?? 0) <= now);
        if (!id) {
          const next = Math.min(...candidates.map((candidate) => retryAt.current.get(candidate) ?? now));
          await sleep(Math.min(3_000, Math.max(1_000, next - now)));
          continue;
        }

        const result = await requestBatch(id);
        if (stopped) break;

        if (result.ok) {
          if (result.status === "ready") settled.current.add(id);
          if (result.waiting) retryAt.current.set(id, Date.now() + WAIT_WHEN_LOCKED_MS);
        } else if (result.sessionExpired) {
          toast.error("Tu sesión expiró. Vuelve a iniciar sesión para seguir leyendo tu material.");
          break;
        } else if (result.retryable) {
          retryAt.current.set(id, Date.now() + WAIT_WHEN_BUSY_MS);
        } else {
          settled.current.add(id);
        }
        router.refresh();
      }
    };

    void loop();
    return () => {
      stopped = true;
    };
  }, [active, router]);

  if (!active) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />
      {pendingIds.length === 1
        ? "Focus está leyendo tu material. Mantén esta página abierta hasta que termine."
        : `Focus está leyendo ${pendingIds.length} materiales. Mantén esta página abierta hasta que termine.`}
    </p>
  );
}
