import { describe, expect, it } from "vitest";

import { finalizeAnswer, locationLabel, sourceLabel, stripCitationMarkers, type ChatSource } from "./citations";

const source = (n: number, extra: Partial<ChatSource> = {}): ChatSource => ({
  n,
  chunk_id: `chunk-${n}`,
  material_id: `material-${n}`,
  title: `Documento ${n}`,
  kind: "pdf",
  page: n * 2,
  start_seconds: null,
  section: null,
  source_url: null,
  content: "texto",
  ...extra,
});

describe("finalizeAnswer", () => {
  const sources = [source(1), source(2), source(3)];

  it("keeps valid citations in order of first appearance", () => {
    const answer = finalizeAnswer("La derivada mide el cambio [2]. Se calcula con límites [1][2].", sources);
    expect(answer.citations.map((citation) => citation.n)).toEqual([2, 1]);
    expect(answer.citations[0]).toMatchObject({ chunk_id: "chunk-2", page: 4, title: "Documento 2" });
    expect(answer.citations[0]).not.toHaveProperty("content");
    expect(answer.content).toBe("La derivada mide el cambio [2]. Se calcula con límites [1][2].");
  });

  it("removes numbers that were not given as sources", () => {
    const answer = finalizeAnswer("Dato inventado [7]. Dato real [3].", sources);
    expect(answer.content).toBe("Dato inventado. Dato real [3].");
    expect(answer.citations.map((citation) => citation.n)).toEqual([3]);
  });

  it("expands grouped citations", () => {
    expect(finalizeAnswer("Ver [1, 3] y [1-2].", sources).content).toBe("Ver [1][3] y [1][2].");
  });

  it("detects the general knowledge paragraph", () => {
    const answer = finalizeAnswer("No encontré esto en tu material.\n\n**Conocimiento general:** Es así.", []);
    expect(answer.usedGeneralKnowledge).toBe(true);
    expect(answer.citations).toEqual([]);
    expect(finalizeAnswer("Respuesta [1].", sources).usedGeneralKnowledge).toBe(false);
  });

  it("works without any source", () => {
    expect(finalizeAnswer("Hola [1].", []).content).toBe("Hola.");
  });
});

describe("labels", () => {
  it("describes where each kind of source is", () => {
    expect(locationLabel(source(1))).toBe("p. 2");
    expect(locationLabel(source(1, { kind: "pptx", page: 5 }))).toBe("diapositiva 5");
    expect(locationLabel(source(1, { kind: "images", page: 3 }))).toBe("foto 3");
    expect(locationLabel(source(1, { kind: "youtube", page: null, start_seconds: 725 }))).toBe("min 12:05");
    expect(locationLabel(source(1, { kind: "docx", page: null, section: "Introducción" }))).toBe("«Introducción»");
    expect(locationLabel(source(1, { kind: "web", page: null }))).toBeNull();
    expect(sourceLabel(source(4))).toBe("Documento 4, p. 8");
  });
});

describe("stripCitationMarkers", () => {
  it("removes every source number", () => {
    expect(stripCitationMarkers("Uno [1]. Dos [2, 3].")).toBe("Uno. Dos.");
  });
});
