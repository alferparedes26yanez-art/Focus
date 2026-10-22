import { describe, expect, it } from "vitest";

import { planMaterials, storageFileName, titleFromFileName } from "./files";

const file = (name: string, size = 1000, type = "") => ({ name, size, type });

describe("planMaterials", () => {
  it("makes one material per document and groups photos", () => {
    const plan = planMaterials(
      [file("Clase 1.pdf"), file("foto1.jpg", 10, "image/jpeg"), file("Tema 2.pptx"), file("foto2.heic")],
      { groupPhotos: true, photosTitle: "Apuntes del lunes" },
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.materials.map((material) => [material.kind, material.title, material.files.length])).toEqual([
      ["pdf", "Clase 1", 1],
      ["pptx", "Tema 2", 1],
      ["images", "Apuntes del lunes", 2],
    ]);
    expect(plan.materials[2].files.map((photo) => photo.index)).toEqual([1, 3]);
    expect(plan.materials[2].files[1].mimeType).toBe("image/heic");
  });

  it("keeps photos apart when asked", () => {
    const plan = planMaterials([file("a.jpg"), file("b.png")], { groupPhotos: false });
    expect(plan.ok && plan.materials.map((material) => material.title)).toEqual(["a", "b"]);
  });

  it("rejects unsupported, empty and oversized files", () => {
    expect(planMaterials([file("hoja.xlsx")], { groupPhotos: true })).toMatchObject({ ok: false });
    expect(planMaterials([file("vacío.pdf", 0)], { groupPhotos: true })).toMatchObject({ ok: false });
    expect(planMaterials([file("libro.pdf", 51 * 1024 * 1024)], { groupPhotos: true })).toMatchObject({ ok: false });
    expect(planMaterials([], { groupPhotos: true })).toMatchObject({ ok: false });
  });
});

describe("file names", () => {
  it("builds a readable title", () => {
    expect(titleFromFileName("Cálculo_I-unidad__2.pdf")).toBe("Cálculo I unidad 2");
  });

  it("builds a storage-safe name with the right extension", () => {
    expect(storageFileName("Clase de Física (1).PDF", "application/pdf")).toBe("Clase-de-Fisica-1.pdf");
    expect(storageFileName("ñ.jpeg", "image/jpeg")).toBe("n.jpg");
  });
});
