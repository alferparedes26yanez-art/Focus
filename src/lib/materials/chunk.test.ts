import { describe, expect, it } from "vitest";

import { chunkUnits, joinChunkTexts, normalizeText } from "./chunk";

const sentence = (n: number) => `Esta es la oración número ${n} sobre límites y derivadas.`;
const paragraph = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => sentence(from + index)).join(" ");

describe("chunkUnits", () => {
  it("never mixes two pages in a fragment and keeps the page number", () => {
    const drafts = chunkUnits([
      { page: 1, text: "Introducción breve." },
      { page: 2, text: "Segunda página." },
    ]);
    expect(drafts).toEqual([
      { content: "Introducción breve.", page: 1, start_seconds: null, section: null },
      { content: "Segunda página.", page: 2, start_seconds: null, section: null },
    ]);
  });

  it("splits long text into fragments of bounded size with some overlap", () => {
    const text = [paragraph(1, 15), paragraph(16, 15), paragraph(31, 15)].join("\n\n");
    const drafts = chunkUnits([{ page: 4, text }]);
    expect(drafts.length).toBeGreaterThan(1);
    for (const draft of drafts) {
      expect(draft.content.length).toBeLessThanOrEqual(1800);
      expect(draft.page).toBe(4);
    }
    // The second fragment starts with the end of the first one.
    const overlap = drafts[1].content.split("\n\n")[0];
    expect(overlap.length).toBeLessThanOrEqual(150);
    expect(drafts[0].content.endsWith(overlap)).toBe(true);
  });

  it("cuts a single huge paragraph without losing words", () => {
    const text = "palabra ".repeat(1000).trim();
    const drafts = chunkUnits([{ page: 1, text }]);
    expect(drafts.every((draft) => draft.content.length <= 1800)).toBe(true);
    expect(drafts.map((draft) => draft.content).join(" ").split(" ").filter(Boolean).length).toBeGreaterThanOrEqual(1000);
  });

  it("merges short video segments and keeps the minute where each fragment starts", () => {
    const drafts = chunkUnits([
      { startSeconds: 0, text: "Hola a todos." },
      { startSeconds: 30, text: "Hoy vemos derivadas." },
      { startSeconds: 65, text: paragraph(1, 25) },
      { startSeconds: 130, text: "Fin de la clase." },
    ]);
    expect(drafts[0]).toMatchObject({ start_seconds: 0, page: null });
    expect(drafts[0].content).toContain("Hoy vemos derivadas.");
    expect(drafts.at(-1)?.start_seconds).toBeGreaterThanOrEqual(65);
    expect(drafts.map((draft) => draft.content).join(" ")).toContain("Fin de la clase.");
  });

  it("keeps the section of Word and web fragments", () => {
    expect(chunkUnits([{ section: "Capítulo 2", text: "Contenido." }])[0].section).toBe("Capítulo 2");
  });

  it("skips empty text", () => {
    expect(chunkUnits([{ page: 1, text: "   \n " }])).toEqual([]);
  });
});

describe("normalizeText", () => {
  it("collapses spaces and blank lines", () => {
    expect(normalizeText("a  \t b\r\n\n\n\nc ")).toBe("a b\n\nc");
  });
});

describe("joinChunkTexts", () => {
  it("removes the overlap repeated between consecutive fragments", () => {
    const text = [paragraph(1, 15), paragraph(16, 15), paragraph(31, 15)].join("\n\n");
    const drafts = chunkUnits([{ page: 1, text }]);
    const joined = joinChunkTexts(drafts.map((draft) => draft.content));
    expect(normalizeText(joined).replace(/\s+/g, " ")).toBe(normalizeText(text).replace(/\s+/g, " "));
  });

  it("joins unrelated fragments with a blank line", () => {
    expect(joinChunkTexts(["Uno.", "Dos."])).toBe("Uno.\n\nDos.");
  });
});
