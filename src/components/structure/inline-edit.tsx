"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Text that becomes an input on click. Enter or leaving the field saves,
// Escape cancels. `editing` can also be driven from outside (menu "Renombrar").
export function InlineEdit({
  value,
  onSave,
  ariaLabel,
  maxLength,
  disabled,
  editing: editingProp,
  onEditingChange,
  className,
}: {
  value: string;
  onSave: (value: string) => void;
  ariaLabel: string;
  maxLength: number;
  disabled?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  className?: string;
}) {
  const [editingState, setEditingState] = useState(false);
  const [draft, setDraft] = useState(value);
  const editing = editingProp ?? editingState;
  // Removing the input can fire a late blur; this keeps it from saving twice.
  const finished = useRef(false);

  const setEditing = (next: boolean) => {
    if (next) {
      setDraft(value);
      finished.current = false;
    }
    setEditingState(next);
    onEditingChange?.(next);
  };

  // Opened from outside: start from the current value.
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setDraft(value);
  }

  const commit = () => {
    if (finished.current) return;
    finished.current = true;
    const next = draft.replace(/\s+/g, " ").trim();
    setEditing(false);
    if (next && next !== value) onSave(next);
  };

  const cancel = () => {
    finished.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        onFocus={() => {
          finished.current = false;
        }}
        aria-label={ariaLabel}
        value={draft}
        maxLength={maxLength}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(
          "w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      title="Clic para editar"
      className={cn(
        "w-full min-w-0 cursor-text rounded-md px-2 py-1 text-left break-words hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent",
        className,
      )}
    >
      {value}
    </button>
  );
}
