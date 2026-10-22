"use client";

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { GENERAL_KNOWLEDGE_MARK, sourceLabel, type Citation } from "@/lib/chat/citations";
import { materialHref } from "@/lib/materials/types";
import { cn } from "@/lib/utils";

// Source numbers become links (#cite-n) that render as citation chips, and the
// general-knowledge paragraph becomes a highlighted block.
function prepare(content: string): string {
  return content
    .split("\n")
    .map((line) => (line.trimStart().startsWith(GENERAL_KNOWLEDGE_MARK) ? `> ${line.trimStart()}` : line))
    .join("\n")
    .replace(/\[(\d{1,2})\](?!\()/g, "[$1](#cite-$1)");
}

export function CitationChip({
  n,
  citation,
  subjectId,
}: {
  n: number;
  citation?: Citation;
  subjectId: string;
}) {
  const className =
    "mx-0.5 inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary/12 px-1 align-[0.15em] text-[0.7rem] leading-none font-semibold text-primary no-underline tabular-nums";
  if (!citation) return <span className={cn(className, "bg-muted text-muted-foreground")}>{n}</span>;
  return (
    <Link
      href={materialHref(subjectId, citation.material_id, {
        page: citation.page,
        seconds: citation.start_seconds,
        chunkId: citation.chunk_id,
      })}
      title={sourceLabel(citation)}
      aria-label={`Fuente ${n}: ${sourceLabel(citation)}`}
      className={cn(className, "hover:bg-primary hover:text-primary-foreground")}
    >
      {n}
    </Link>
  );
}

export function ChatMarkdown({
  content,
  citations,
  subjectId,
}: {
  content: string;
  citations: Citation[];
  subjectId: string;
}) {
  const byNumber = new Map(citations.map((citation) => [citation.n, citation]));

  const components: Components = {
    a: ({ href, children }) => {
      const cite = href?.match(/^#cite-(\d+)$/);
      if (cite) {
        const n = Number(cite[1]);
        return <CitationChip n={n} citation={byNumber.get(n)} subjectId={subjectId} />;
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
          {children}
        </a>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="my-3 rounded-r-lg border-l-4 border-warning-foreground/40 bg-warning px-3 py-1 text-warning-foreground">{children}</blockquote>
    ),
  };

  return (
    <div
      className={cn(
        "text-sm leading-relaxed break-words",
        "[&_p]:my-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1",
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[0.85em] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3",
        "[&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {prepare(content)}
      </ReactMarkdown>
    </div>
  );
}
