"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

// "+ Agregar ..." button that turns into an input. Stays open after Enter so
// several items can be typed in a row.
export function AddItemInput({
  label,
  placeholder,
  maxLength,
  onAdd,
  className,
  open: openProp,
  onOpenChange,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  onAdd: (title: string) => void;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [value, setValue] = useState("");
  // Escape closes without saving even if the browser fires a late blur.
  const cancelled = useRef(false);

  const submit = () => {
    const title = value.replace(/\s+/g, " ").trim();
    if (title) onAdd(title);
    setValue("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
          className,
        )}
      >
        <Plus className="size-4" />
        {label}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => setValue(event.target.value)}
      onFocus={() => {
        cancelled.current = false;
      }}
      onBlur={() => {
        if (!cancelled.current) submit();
        setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelled.current = true;
          setValue("");
          setOpen(false);
        }
      }}
      className={cn(
        "w-full rounded-md border border-input bg-background px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm",
        className,
      )}
    />
  );
}
