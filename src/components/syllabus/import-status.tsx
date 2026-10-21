"use client";

import { LoaderCircle, RotateCw, Sparkles, TriangleAlert, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

import { requestExtraction } from "./syllabus-uploader";

// Review page when the import is not ready: still reading, never started
// (the tab was closed after uploading) or failed.
export function ImportStatus({
  importId,
  subjectId,
  status,
  error,
  onboarding,
}: {
  importId: string;
  subjectId: string;
  status: "pending" | "processing" | "failed";
  error: string | null;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [running, startRunning] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const uploadUrl = `/subjects/${subjectId}/syllabus${onboarding ? "?onboarding=1" : ""}`;

  // While another request is reading it, check again every few seconds.
  useEffect(() => {
    if (status !== "processing") return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [status, router]);

  const read = () =>
    startRunning(async () => {
      setMessage(null);
      const result = await requestExtraction(importId);
      if (!result.ok) setMessage(result.error);
      router.refresh();
    });

  if (status === "processing" || running) {
    return (
      <EmptyState
        icon={LoaderCircle}
        title="Estamos leyendo tu sílabo"
        description="Suele tardar entre 10 y 40 segundos. Esta página se actualiza sola."
        className="[&_svg]:animate-spin"
      />
    );
  }

  if (status === "pending") {
    return (
      <EmptyState
        icon={Sparkles}
        title="Tu sílabo ya está subido"
        description="Falta que la IA lo lea y organice."
        action={
          <Button onClick={read}>
            <Sparkles />
            Leer sílabo
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={TriangleAlert}
      title="No pudimos leer el sílabo"
      description={message ?? error ?? "Ocurrió un error inesperado."}
      action={
        <>
          <Button onClick={read}>
            <RotateCw />
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href={uploadUrl}>
              <Upload />
              Subir otro archivo
            </Link>
          </Button>
        </>
      }
    />
  );
}
