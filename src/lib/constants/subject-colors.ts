// Subject colors are stored as a name (not hex) so each one can look right in
// light and dark mode. Full class strings so Tailwind can see them.

export const SUBJECT_COLORS = {
  red: { label: "Rojo", swatch: "bg-red-500", soft: "bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300", bar: "bg-red-500" },
  orange: { label: "Naranja", swatch: "bg-orange-500", soft: "bg-orange-500/12 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300", bar: "bg-orange-500" },
  amber: { label: "Ámbar", swatch: "bg-amber-500", soft: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300", bar: "bg-amber-500" },
  green: { label: "Verde", swatch: "bg-green-600", soft: "bg-green-600/12 text-green-700 dark:bg-green-400/15 dark:text-green-300", bar: "bg-green-600" },
  teal: { label: "Turquesa", swatch: "bg-teal-500", soft: "bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300", bar: "bg-teal-500" },
  sky: { label: "Celeste", swatch: "bg-sky-500", soft: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300", bar: "bg-sky-500" },
  blue: { label: "Azul", swatch: "bg-blue-600", soft: "bg-blue-600/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300", bar: "bg-blue-600" },
  indigo: { label: "Índigo", swatch: "bg-indigo-500", soft: "bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300", bar: "bg-indigo-500" },
  violet: { label: "Violeta", swatch: "bg-violet-500", soft: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300", bar: "bg-violet-500" },
  pink: { label: "Rosado", swatch: "bg-pink-500", soft: "bg-pink-500/12 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300", bar: "bg-pink-500" },
} as const;

export type SubjectColor = keyof typeof SUBJECT_COLORS;

export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS) as SubjectColor[];

export function getSubjectColor(color: string) {
  return SUBJECT_COLORS[color as SubjectColor] ?? SUBJECT_COLORS.indigo;
}
