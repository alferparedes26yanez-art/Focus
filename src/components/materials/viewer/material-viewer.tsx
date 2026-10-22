import { ChevronDown, ChevronUp, Download, ExternalLink, FileSearch, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MaterialDetail, ViewerChunk } from "@/lib/data/materials";
import { joinChunkTexts } from "@/lib/materials/chunk";
import { parseYoutubeId } from "@/lib/materials/extract/youtube";
import { materialHref, progressNoun, type MaterialKind } from "@/lib/materials/types";

import { ScrollTo } from "./scroll-to";
import { TextBlocks, type TextBlock } from "./text-blocks";
import { VideoViewer } from "./video-viewer";

export type ViewerFocus = { page: number | null; seconds: number | null; chunkId: string | null };

const PAGE_LABELS: Partial<Record<MaterialKind, string>> = {
  pdf: "Página",
  pptx: "Diapositiva",
  images: "Foto",
};

function pageBlocks(detail: MaterialDetail, citedPage: number | null): TextBlock[] {
  const byPage = new Map<number, ViewerChunk[]>();
  for (const chunk of detail.chunks) {
    if (chunk.page === null) continue;
    byPage.set(chunk.page, [...(byPage.get(chunk.page) ?? []), chunk]);
  }
  const label = PAGE_LABELS[detail.material.kind] ?? "Página";
  const photos = detail.material.kind === "images" ? detail.files : [];

  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, chunks]) => {
      const photo = photos[page - 1];
      return {
        id: `p-${page}`,
        label: `${label} ${page}`,
        text: joinChunkTexts(chunks.map((chunk) => chunk.content)),
        highlighted: page === citedPage,
        media: photo ? (
          <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
            {/* Signed Storage URL: a plain img avoids the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`Foto ${page}`} className="max-h-[70vh] w-auto rounded-lg border" loading="lazy" />
          </a>
        ) : undefined,
      };
    });
}

// Word and web pages: consecutive fragments of the same section together.
function sectionBlocks(detail: MaterialDetail, focus: ViewerFocus): TextBlock[] {
  const groups: { section: string | null; chunks: ViewerChunk[] }[] = [];
  for (const chunk of detail.chunks) {
    const last = groups.at(-1);
    if (last && last.section === chunk.section) last.chunks.push(chunk);
    else groups.push({ section: chunk.section, chunks: [chunk] });
  }
  return groups.map((group) => ({
    id: `chunk-${group.chunks[0].id}`,
    label: group.section,
    text: joinChunkTexts(group.chunks.map((chunk) => chunk.content)),
    highlighted: group.chunks.some((chunk) => chunk.id === focus.chunkId),
  }));
}

function targetOf(blocks: TextBlock[]): string | null {
  return blocks.find((block) => block.highlighted)?.id ?? null;
}

function PageWindowLink({
  detail,
  direction,
}: {
  detail: MaterialDetail;
  direction: "previous" | "next";
}) {
  const range = detail.window;
  if (!range) return null;
  const noun = progressNoun(detail.material.kind, 2);
  if (direction === "previous") {
    if (range.firstPage <= 1) return null;
    const first = Math.max(1, range.firstPage - 20);
    return (
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={materialHref(detail.subject.id, detail.material.id, { page: first + 2 })} scroll={false}>
          <ChevronUp />
          Ver {noun} {first}–{range.firstPage - 1}
        </Link>
      </Button>
    );
  }
  if (!range.totalPages || range.lastPage >= range.totalPages) return null;
  const first = range.lastPage + 1;
  return (
    <Button asChild variant="outline" size="sm" className="w-fit">
      <Link href={materialHref(detail.subject.id, detail.material.id, { page: first + 2 })} scroll={false}>
        <ChevronDown />
        Ver {noun} {first}–{Math.min(first + 19, range.totalPages)}
      </Link>
    </Button>
  );
}

function StatusNotice({ detail }: { detail: MaterialDetail }) {
  const { material } = detail;
  if (material.status === "failed") {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{material.error ?? "No pudimos leer este material."}</AlertDescription>
      </Alert>
    );
  }
  if (material.status !== "ready") {
    const total = material.total_units;
    return (
      <Alert>
        <LoaderCircle className="animate-spin" />
        <AlertDescription className="text-foreground">
          Todavía se está leyendo
          {total ? ` (${material.processed_units} de ${total} ${progressNoun(material.kind, total)})` : ""}. Abre la
          materia para que continúe; aquí ves lo que ya está listo.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function MaterialViewer({ detail, focus }: { detail: MaterialDetail; focus: ViewerFocus }) {
  const { material, files } = detail;
  const file = files[0];

  if (material.kind === "youtube") {
    const videoId = parseYoutubeId(material.source_url ?? "");
    const lines = detail.chunks
      .filter((chunk) => chunk.start_seconds !== null)
      .map((chunk) => ({ id: chunk.id, startSeconds: chunk.start_seconds ?? 0, text: chunk.content }));
    const cited =
      lines.find((line) => line.id === focus.chunkId) ??
      (focus.seconds !== null ? [...lines].reverse().find((line) => line.startSeconds <= focus.seconds!) : undefined);
    return (
      <div className="grid gap-4">
        <StatusNotice detail={detail} />
        {videoId ? (
          <VideoViewer
            videoId={videoId}
            title={material.title}
            initialSeconds={focus.seconds ?? cited?.startSeconds ?? 0}
            lines={lines}
            highlightedId={cited?.id ?? null}
          />
        ) : null}
        <ScrollTo targetId={cited ? `chunk-${cited.id}` : null} />
      </div>
    );
  }

  const paged = material.kind === "pdf" || material.kind === "pptx" || material.kind === "images";
  const citedPage = paged
    ? (detail.chunks.find((chunk) => chunk.id === focus.chunkId)?.page ?? focus.page ?? null)
    : null;
  const blocks = paged ? pageBlocks(detail, citedPage) : sectionBlocks(detail, focus);

  return (
    <div className="grid gap-4">
      <StatusNotice detail={detail} />

      <div className="flex flex-wrap gap-2">
        {material.kind === "pdf" && file ? (
          <Button asChild>
            <a href={`${file.url}#page=${citedPage ?? 1}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              {citedPage ? `Abrir el PDF en la página ${citedPage}` : "Abrir el PDF"}
            </a>
          </Button>
        ) : null}
        {(material.kind === "pptx" || material.kind === "docx") && file ? (
          <Button asChild variant="outline">
            <a href={file.url} target="_blank" rel="noopener noreferrer" download={file.name}>
              <Download />
              Descargar {material.kind === "pptx" ? "presentación" : "documento"}
            </a>
          </Button>
        ) : null}
        {material.kind === "web" && material.source_url ? (
          <Button asChild variant="outline">
            <a href={material.source_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Abrir la página original
            </a>
          </Button>
        ) : null}
      </div>

      {material.kind === "pdf" && file ? (
        <iframe
          key={citedPage ?? "1"}
          src={`${file.url}#page=${citedPage ?? 1}`}
          title={material.title}
          className="hidden h-[75vh] w-full rounded-xl border md:block"
        />
      ) : null}

      <PageWindowLink detail={detail} direction="previous" />
      {blocks.length > 0 ? (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground">
            {material.kind === "pdf" ? "Texto extraído" : material.kind === "images" ? "Fotos y su texto" : "Contenido"}
          </h2>
          <TextBlocks blocks={blocks} />
        </>
      ) : material.status === "ready" ? (
        <EmptyState
          icon={FileSearch}
          title="No hay texto en esta parte"
          description="Prueba con otras páginas o abre el archivo original."
        />
      ) : null}
      <PageWindowLink detail={detail} direction="next" />
      <ScrollTo targetId={targetOf(blocks)} />
    </div>
  );
}
