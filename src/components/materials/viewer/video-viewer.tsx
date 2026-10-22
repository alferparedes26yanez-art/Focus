"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import { formatDuration } from "@/lib/materials/extract/youtube";
import { cn } from "@/lib/utils";

export type TranscriptLine = { id: string; startSeconds: number; text: string };

// YouTube player and its transcript: tapping a minute jumps the video there.
export function VideoViewer({
  videoId,
  title,
  initialSeconds,
  lines,
  highlightedId,
}: {
  videoId: string;
  title: string;
  initialSeconds: number;
  lines: TranscriptLine[];
  highlightedId: string | null;
}) {
  const [start, setStart] = useState({ seconds: initialSeconds, autoplay: false });
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?start=${start.seconds}&rel=0${start.autoplay ? "&autoplay=1" : ""}`;

  return (
    <div className="grid gap-4">
      <div className="sticky top-14 z-10 -mx-4 bg-background px-4 pb-2 md:static md:mx-0 md:px-0">
        <iframe
          key={`${start.seconds}-${start.autoplay}`}
          src={src}
          title={title}
          className="aspect-video w-full rounded-xl border"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <ol className="grid gap-2">
        {lines.map((line) => (
          <li
            key={line.id}
            id={`chunk-${line.id}`}
            className={cn(
              "scroll-mt-[calc(56vw+5rem)] grid gap-1 rounded-xl border bg-card p-3 md:scroll-mt-20",
              line.id === highlightedId && "border-primary/60 ring-2 ring-primary/30",
            )}
          >
            <button
              type="button"
              onClick={() => setStart({ seconds: line.startSeconds, autoplay: true })}
              className="flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums hover:bg-primary hover:text-primary-foreground"
            >
              <Play className="size-3" />
              {formatDuration(line.startSeconds)}
            </button>
            <p className="text-sm leading-relaxed">{line.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
