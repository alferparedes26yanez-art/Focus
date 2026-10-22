import { cn } from "@/lib/utils";

export type TextBlock = {
  id: string;
  label: string | null;
  text: string;
  highlighted: boolean;
  media?: React.ReactNode;
};

// The extracted text of a material, split by page, slide, photo or section.
// The cited block is highlighted.
export function TextBlocks({ blocks }: { blocks: TextBlock[] }) {
  return (
    <div className="grid gap-3">
      {blocks.map((block) => (
        <section
          key={block.id}
          id={block.id}
          className={cn(
            "scroll-mt-20 grid gap-2 rounded-xl border bg-card p-4",
            block.highlighted && "border-primary/60 ring-2 ring-primary/30",
          )}
          aria-current={block.highlighted ? "location" : undefined}
        >
          {block.label ? (
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {block.label}
              {block.highlighted ? (
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[0.65rem] text-primary normal-case">
                  Citado
                </span>
              ) : null}
            </p>
          ) : null}
          {block.media}
          {block.text ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{block.text}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin texto legible.</p>
          )}
        </section>
      ))}
    </div>
  );
}
