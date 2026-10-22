"use client";

import { useRef } from "react";

// Menu items that open an input or a dialog must wait until the menu has
// closed and released focus; otherwise the menu takes focus back and the
// input closes.
export function useMenuFollowUp<K extends string>(actions: Record<K, () => void>) {
  const queued = useRef<K | null>(null);
  return {
    queue: (key: K) => {
      queued.current = key;
    },
    onCloseAutoFocus: (event: Event) => {
      const key = queued.current;
      queued.current = null;
      if (key) {
        event.preventDefault();
        actions[key]();
      }
    },
  };
}
