import { FileText, FileType, Globe, Images, MonitorPlay, Presentation, type LucideIcon } from "lucide-react";

import type { MaterialKind } from "@/lib/materials/types";
import { cn } from "@/lib/utils";

const ICONS: Record<MaterialKind, LucideIcon> = {
  pdf: FileText,
  docx: FileType,
  pptx: Presentation,
  images: Images,
  web: Globe,
  youtube: MonitorPlay,
};

const TONES: Record<MaterialKind, string> = {
  pdf: "bg-red-500/10 text-red-600 dark:text-red-400",
  docx: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pptx: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  images: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  web: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  youtube: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function MaterialIcon({ kind, className }: { kind: MaterialKind; className?: string }) {
  const Icon = ICONS[kind] ?? FileText;
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONES[kind], className)}>
      <Icon className="size-4.5" />
    </span>
  );
}
