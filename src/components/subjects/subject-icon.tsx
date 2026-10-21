import { BookOpen } from "lucide-react";

import { getSubjectColor } from "@/lib/constants/subject-colors";
import { SUBJECT_ICONS } from "@/lib/constants/subject-icons";
import { cn } from "@/lib/utils";

export function SubjectIcon({
  color,
  icon,
  size = "md",
  className,
}: {
  color: string;
  icon: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = SUBJECT_ICONS[icon] ?? BookOpen;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        getSubjectColor(color).soft,
        size === "sm" && "size-8 rounded-lg [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-14 rounded-2xl [&_svg]:size-7",
        className,
      )}
    >
      <Icon />
    </span>
  );
}
