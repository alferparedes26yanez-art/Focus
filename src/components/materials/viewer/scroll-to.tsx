"use client";

import { useEffect } from "react";

// Brings the cited page, fragment or minute into view when the viewer opens.
export function ScrollTo({ targetId }: { targetId: string | null }) {
  useEffect(() => {
    if (!targetId) return;
    document.getElementById(targetId)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [targetId]);
  return null;
}
