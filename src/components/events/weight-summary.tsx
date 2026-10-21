import { CircleCheck, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

// Sum of the evaluation weights; warns when it is not 100 %.
export function WeightSummary({ weights, className }: { weights: (number | null)[]; className?: string }) {
  const known = weights.filter((weight): weight is number => weight !== null);
  if (known.length === 0) return null;
  const total = Math.round(known.reduce((sum, weight) => sum + weight, 0) * 10) / 10;
  const complete = Math.abs(total - 100) <= 0.5;

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-sm",
        complete ? "text-muted-foreground" : "text-warning-foreground",
        className,
      )}
    >
      {complete ? <CircleCheck className="size-4 text-success" /> : <TriangleAlert className="size-4" />}
      Ponderación total: <span className="font-medium tabular-nums">{total} %</span>
      {complete ? null : <span className="hidden sm:inline">· debería sumar 100 %</span>}
    </p>
  );
}
