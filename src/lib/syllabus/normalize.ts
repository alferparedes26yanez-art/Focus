import { isRealDate, type SyllabusAiOutput, type SyllabusDraft } from "./schemas";

// Turns the raw AI answer into a clean draft: trims and truncates text, drops
// empty items, rejects malformed dates/times/weights instead of trusting them,
// converts unit numbers to indexes and adds warnings the student should see.

const MAX_WARNINGS = 12;

function clean(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

export function normalizeSyllabusOutput(
  output: SyllabusAiOutput,
  options: { today: string },
): { isSyllabus: boolean; draft: SyllabusDraft } {
  const warnings: string[] = [];

  const units = output.units
    .map((unit) => ({
      title: clean(unit.title, 200),
      topics: unit.topics
        .map((topic) => ({
          title: clean(topic.title, 300),
          description: clean(topic.details, 2000),
        }))
        .filter((topic): topic is { title: string; description: string | null } => topic.title !== null)
        .slice(0, 200),
    }))
    .filter((unit): unit is { title: string; topics: typeof unit.topics } => unit.title !== null)
    .slice(0, 60);

  const events = output.events
    .map((event) => {
      const title = clean(event.title, 200);
      if (!title) return null;

      let eventDate = clean(event.date, 10);
      if (eventDate && !isRealDate(eventDate)) {
        warnings.push(`La fecha de «${title}» no se pudo leer: complétala.`);
        eventDate = null;
      }
      if (eventDate) {
        const offset = daysBetween(options.today, eventDate);
        if (offset < -365 || offset > 550) {
          warnings.push(`La fecha de «${title}» parece de otro año: revísala.`);
        }
      }

      const rawTime = clean(event.time, 5);
      const eventTime = rawTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : null;

      const weight =
        typeof event.weight_percent === "number" &&
        Number.isFinite(event.weight_percent) &&
        event.weight_percent >= 0 &&
        event.weight_percent <= 100
          ? Math.round(event.weight_percent * 100) / 100
          : null;

      const dateText = clean(event.date_text, 200);
      const unitIndexes = [
        ...new Set(
          event.unit_numbers
            .filter((n) => Number.isInteger(n) && n >= 1 && n <= units.length)
            .map((n) => n - 1),
        ),
      ];

      return {
        kind: event.kind,
        title,
        event_date: eventDate,
        event_time: eventTime,
        weight,
        notes: !eventDate && dateText ? `Fecha en el sílabo: ${dateText}` : null,
        unit_indexes: unitIndexes,
      };
    })
    .filter((event) => event !== null)
    .slice(0, 100);

  const undated = events.filter((event) => !event.event_date && event.kind !== "other").length;
  if (undated > 0) {
    warnings.push(
      undated === 1
        ? "Una evaluación no tiene fecha exacta: complétala si la conoces."
        : `${undated} evaluaciones no tienen fecha exacta: complétalas si las conoces.`,
    );
  }

  const weighted = events.filter((event) => event.weight !== null);
  if (weighted.length > 0) {
    const total = weighted.reduce((sum, event) => sum + (event.weight ?? 0), 0);
    if (Math.abs(total - 100) > 0.5) {
      warnings.push(
        `Las ponderaciones suman ${Math.round(total * 10) / 10} %: revisa si falta o sobra alguna evaluación.`,
      );
    }
  }

  if (units.length === 0) {
    warnings.push("No encontramos unidades ni temas: puedes agregarlos a mano.");
  }

  const email = clean(output.teacher.email, 200);
  const bibliography = output.bibliography
    .map((item) => {
      const url = clean(item.url, 1000);
      return {
        citation: clean(item.citation, 1000),
        kind: item.kind,
        url: url && /^https?:\/\//i.test(url) ? url : null,
      };
    })
    .filter((item): item is { citation: string; kind: typeof item.kind; url: string | null } => item.citation !== null)
    .slice(0, 100);

  const aiWarnings = output.warnings
    .map((warning) => clean(warning, 300))
    .filter((warning): warning is string => warning !== null);

  return {
    isSyllabus: output.is_syllabus,
    draft: {
      course_term: clean(output.course_term, 200),
      teacher: {
        name: clean(output.teacher.name, 120),
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
        notes: clean(output.teacher.notes, 1000),
      },
      units,
      events,
      bibliography,
      warnings: [...new Set([...aiWarnings, ...warnings])].slice(0, MAX_WARNINGS),
    },
  };
}
