import { describe, expect, it } from "vitest";

import { normalizeSyllabusOutput } from "./normalize";
import type { SyllabusAiOutput } from "./schemas";

function output(overrides: Partial<SyllabusAiOutput> = {}): SyllabusAiOutput {
  return {
    is_syllabus: true,
    not_syllabus_reason: null,
    course_term: "2026-2",
    teacher: { name: "  Dra.   Ana Pérez ", email: "ana@uni.edu.ec", notes: null },
    units: [
      { title: "Unidad 1: Límites", topics: [{ title: "Definición", details: null }, { title: "  ", details: null }] },
      { title: "Unidad 2: Derivadas", topics: [{ title: "Reglas", details: "Producto; cociente" }] },
      { title: "   ", topics: [] },
    ],
    events: [
      {
        kind: "exam",
        title: "Parcial 1",
        date: "2026-11-10",
        time: "08:00",
        date_text: "10 de noviembre",
        weight_percent: 30,
        unit_numbers: [1, 2, 2, 9],
      },
      {
        kind: "exam",
        title: "Final",
        date: null,
        time: null,
        date_text: "Semana 16",
        weight_percent: 40,
        unit_numbers: [],
      },
      {
        kind: "other",
        title: "Participación",
        date: null,
        time: null,
        date_text: null,
        weight_percent: 30,
        unit_numbers: [],
      },
    ],
    bibliography: [
      { citation: "Stewart, J. Cálculo.", kind: "basic", url: "javascript:alert(1)" },
      { citation: "", kind: null, url: null },
    ],
    warnings: ["El año de las fechas fue inferido."],
    ...overrides,
  };
}

const today = "2026-10-21";

describe("normalizeSyllabusOutput", () => {
  it("cleans units and topics and drops empty ones", () => {
    const { draft } = normalizeSyllabusOutput(output(), { today });
    expect(draft.units).toEqual([
      { title: "Unidad 1: Límites", topics: [{ title: "Definición", description: null }] },
      { title: "Unidad 2: Derivadas", topics: [{ title: "Reglas", description: "Producto; cociente" }] },
    ]);
    expect(draft.teacher.name).toBe("Dra. Ana Pérez");
  });

  it("converts unit numbers to valid, unique indexes", () => {
    const { draft } = normalizeSyllabusOutput(output(), { today });
    expect(draft.events[0].unit_indexes).toEqual([0, 1]);
  });

  it("keeps the original wording when there is no exact date", () => {
    const { draft } = normalizeSyllabusOutput(output(), { today });
    expect(draft.events[1]).toMatchObject({ event_date: null, notes: "Fecha en el sílabo: Semana 16" });
    expect(draft.warnings).toContain("Una evaluación no tiene fecha exacta: complétala si la conoces.");
  });

  it("rejects impossible dates, bad times and weights instead of trusting them", () => {
    const { draft } = normalizeSyllabusOutput(
      output({
        events: [
          {
            kind: "quiz",
            title: "Lección",
            date: "2026-02-30",
            time: "25:00",
            date_text: null,
            weight_percent: 150,
            unit_numbers: [],
          },
        ],
      }),
      { today },
    );
    expect(draft.events[0]).toMatchObject({ event_date: null, event_time: null, weight: null });
    expect(draft.warnings).toContain("La fecha de «Lección» no se pudo leer: complétala.");
  });

  it("warns when weights do not add up to 100", () => {
    const base = output();
    const { draft } = normalizeSyllabusOutput(
      output({ events: base.events.map((event) => ({ ...event, weight_percent: 20 })) }),
      { today },
    );
    expect(draft.warnings).toContain(
      "Las ponderaciones suman 60 %: revisa si falta o sobra alguna evaluación.",
    );
  });

  it("does not warn when weights add up to 100", () => {
    const { draft } = normalizeSyllabusOutput(output(), { today });
    expect(draft.warnings.some((warning) => warning.startsWith("Las ponderaciones"))).toBe(false);
  });

  it("drops unsafe links and empty references", () => {
    const { draft } = normalizeSyllabusOutput(output(), { today });
    expect(draft.bibliography).toEqual([{ citation: "Stewart, J. Cálculo.", kind: "basic", url: null }]);
  });

  it("flags dates far from today", () => {
    const base = output();
    const { draft } = normalizeSyllabusOutput(
      output({ events: [{ ...base.events[0], date: "2024-11-10" }] }),
      { today },
    );
    expect(draft.warnings).toContain("La fecha de «Parcial 1» parece de otro año: revísala.");
  });

  it("reports documents that are not a syllabus, with the reason", () => {
    const result = normalizeSyllabusOutput(
      output({
        is_syllabus: false,
        not_syllabus_reason: "  Parece una presentación de clase. ",
        units: [],
        events: [],
        bibliography: [],
      }),
      { today },
    );
    expect(result.isSyllabus).toBe(false);
    expect(result.notSyllabusReason).toBe("Parece una presentación de clase.");
  });

  it("accepts a doubtful document when the course contents were found", () => {
    const result = normalizeSyllabusOutput(output({ is_syllabus: false, not_syllabus_reason: "Dudoso" }), { today });
    expect(result.isSyllabus).toBe(true);
    expect(result.notSyllabusReason).toBeNull();
    expect(result.draft.warnings.some((warning) => warning.includes("no está segura"))).toBe(true);
  });
});
