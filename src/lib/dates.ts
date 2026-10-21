// Date helpers. Event dates are plain "YYYY-MM-DD" strings (no time zone), so
// they are always handled as UTC calendar days to avoid off-by-one shifts.

export const DEFAULT_TIME_ZONE = "America/Guayaquil";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Today's calendar date in the user's time zone, as YYYY-MM-DD.
export function todayIn(timeZone: string, now = new Date()): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function daysUntil(isoDate: string, today: string): number {
  return Math.round((toUtcDate(isoDate).getTime() - toUtcDate(today).getTime()) / 86_400_000);
}

export function relativeDayLabel(isoDate: string, today: string): string {
  const days = daysUntil(isoDate, today);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  if (days > 1) return `En ${days} días`;
  return `Hace ${-days} días`;
}

const shortDate = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const shortDateWithYear = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatEventDate(isoDate: string, today?: string): string {
  const date = toUtcDate(isoDate);
  const sameYear = today ? isoDate.slice(0, 4) === today.slice(0, 4) : true;
  return (sameYear ? shortDate : shortDateWithYear).format(date);
}

export function formatTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

export function formatToday(timeZone: string, now = new Date()): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const text = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zone,
  }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
