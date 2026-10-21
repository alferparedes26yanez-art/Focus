import { daysUntil, formatEventDate, relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

const dayFormatter = new Intl.DateTimeFormat("es", { day: "numeric", timeZone: "UTC" });
const monthFormatter = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });

// Calendar-style block: day number over the month.
export function DateBlock({ date, className }: { date: string | null; className?: string }) {
  if (!date) {
    return (
      <div
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-lg border border-dashed text-center text-[10px] leading-tight text-muted-foreground",
          className,
        )}
      >
        Por
        <br />
        confirmar
      </div>
    );
  }
  const value = new Date(`${date}T00:00:00Z`);
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary leading-none",
        className,
      )}
    >
      <span className="text-lg font-semibold tabular-nums">{dayFormatter.format(value)}</span>
      <span className="text-[11px] text-muted-foreground uppercase">
        {monthFormatter.format(value).replace(".", "")}
      </span>
    </div>
  );
}

export function RelativeDay({ date, today }: { date: string; today: string }) {
  const days = daysUntil(date, today);
  return (
    <span
      title={formatEventDate(date, today)}
      className={cn(
        "text-xs font-medium",
        days < 0 && "text-muted-foreground",
        days >= 0 && days <= 3 && "text-destructive",
        days > 3 && days <= 7 && "text-warning-foreground",
        days > 7 && "text-muted-foreground",
      )}
    >
      {relativeDayLabel(date, today)}
    </span>
  );
}
