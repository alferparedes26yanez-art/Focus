import { describe, expect, it } from "vitest";

import {
  formatClassDate,
  notebookDocSchema,
  notebookImagePaths,
  notebookPlainText,
  notebookPreview,
  notebookSections,
  noteMaterialTitle,
  type NotebookNode,
} from "./document";

const text = (value: string, marks?: NotebookNode["marks"]): NotebookNode => ({ type: "text", text: value, marks });
const p = (...content: NotebookNode[]): NotebookNode => ({ type: "paragraph", content });
const h = (level: number, value: string): NotebookNode => ({ type: "heading", attrs: { level }, content: [text(value)] });
const li = (...content: NotebookNode[]): NotebookNode => ({ type: "listItem", content });

const doc: NotebookNode = {
  type: "doc",
  content: [
    p(text("Intro de la clase")),
    h(2, "Normalización"),
    p(text("La "), text("1FN", [{ type: "bold" }]), text(" pide valores atómicos.")),
    { type: "bulletList", content: [li(p(text("Sin grupos repetidos"))), li(p(text("Clave primaria")), { type: "orderedList", content: [li(p(text("simple"))), li(p(text("compuesta")))] })] },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [p(text("Leer capítulo 3"))] },
        { type: "taskItem", attrs: { checked: false }, content: [p(text("Hacer ejercicios"))] },
      ],
    },
    h(2, "Índices"),
    {
      type: "table",
      content: [
        { type: "tableRow", content: [{ type: "tableHeader", content: [p(text("Tipo"))] }, { type: "tableHeader", content: [p(text("Uso"))] }] },
        { type: "tableRow", content: [{ type: "tableCell", content: [p(text("B-tree"))] }, { type: "tableCell", content: [p(text("rangos"))] }] },
      ],
    },
    { type: "image", attrs: { src: "/api/notebook/images/u1/s1/p1/a%20b.jpg", alt: "Pizarra: árbol B con 3 niveles" } },
    { type: "image", attrs: { src: "/api/notebook/images/u1/s1/p1/c.jpg", alt: "" } },
  ],
};

describe("notebook documents", () => {
  it("splits a page into sections at its headings", () => {
    const sections = notebookSections(doc);
    expect(sections.map((section) => section.section)).toEqual([null, "Normalización", "Índices"]);
    expect(sections[1].text).toBe(
      [
        "La 1FN pide valores atómicos.",
        "• Sin grupos repetidos",
        "• Clave primaria",
        "  1. simple",
        "  2. compuesta",
        "☑ Leer capítulo 3",
        "☐ Hacer ejercicios",
      ].join("\n"),
    );
    expect(sections[2].text).toBe("Tipo | Uso\nB-tree | rangos\n[Imagen: Pizarra: árbol B con 3 niveles]");
  });

  it("gives the page text for previews", () => {
    expect(notebookPlainText(doc)).toMatch(/^Intro de la clase\n\nNormalización\nLa 1FN/);
    expect(notebookPreview("  Mucho   texto ".repeat(30), 20)).toHaveLength(20);
    expect(notebookPlainText({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
  });

  it("lists the images of the page", () => {
    expect(notebookImagePaths(doc)).toEqual(["u1/s1/p1/a b.jpg", "u1/s1/p1/c.jpg"]);
  });

  it("names the page in the library and citations", () => {
    expect(formatClassDate("2026-11-06")).toBe("6 nov");
    expect(noteMaterialTitle("Normalización", "2026-11-06")).toBe("Apuntes del 6 nov · Normalización");
  });

  it("validates the editor JSON", () => {
    expect(notebookDocSchema.safeParse(doc).success).toBe(true);
    expect(notebookDocSchema.safeParse({ type: "paragraph" }).success).toBe(false);
    expect(notebookDocSchema.safeParse({ type: "doc", content: [{ type: 3 }] }).success).toBe(false);
  });
});
