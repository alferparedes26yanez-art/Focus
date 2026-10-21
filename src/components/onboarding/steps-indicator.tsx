import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = ["Crea una materia", "Sube el sílabo", "Revisa y guarda"];

export function StepsIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Pasos para empezar">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : step}
            </span>
            <span
              className={cn("hidden text-sm sm:inline", active ? "font-medium" : "text-muted-foreground")}
            >
              {label}
            </span>
            {step < STEPS.length ? <span className="h-px flex-1 bg-border" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
