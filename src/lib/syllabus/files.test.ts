import { describe, expect, it } from "vitest";

import { DOCX_MIME, safeFileName, validateSyllabusFiles } from "./files";

const MB = 1024 * 1024;

describe("validateSyllabusFiles", () => {
  it("accepts one PDF or Word document", () => {
    expect(validateSyllabusFiles([{ name: "silabo.pdf", size: MB, type: "application/pdf" }]).ok).toBe(true);
    const docx = validateSyllabusFiles([{ name: "silabo.docx", size: MB, type: "" }]);
    expect(docx.ok && docx.files[0].mimeType).toBe(DOCX_MIME);
  });

  it("accepts several photos, including HEIC with no reported type", () => {
    const result = validateSyllabusFiles([
      { name: "p1.jpg", size: MB, type: "image/jpeg" },
      { name: "p2.HEIC", size: MB, type: "" },
    ]);
    expect(result.ok && result.files.map((file) => file.mimeType)).toEqual(["image/jpeg", "image/heic"]);
  });

  it("rejects mixed, oversized and unsupported files", () => {
    expect(
      validateSyllabusFiles([
        { name: "a.pdf", size: MB, type: "application/pdf" },
        { name: "b.jpg", size: MB, type: "image/jpeg" },
      ]).ok,
    ).toBe(false);
    expect(validateSyllabusFiles([{ name: "a.pdf", size: 11 * MB, type: "application/pdf" }]).ok).toBe(false);
    expect(validateSyllabusFiles([{ name: "a.doc", size: MB, type: "application/msword" }]).ok).toBe(false);
    expect(
      validateSyllabusFiles([
        { name: "a.pdf", size: MB, type: "application/pdf" },
        { name: "b.pdf", size: MB, type: "application/pdf" },
      ]).ok,
    ).toBe(false);
  });
});

describe("safeFileName", () => {
  it("keeps names ASCII and takes the extension from the type", () => {
    expect(safeFileName("Sílabo Cálculo (2026).PDF", "application/pdf")).toBe("Silabo-Calculo-2026.pdf");
    expect(safeFileName("foto", "image/jpeg")).toBe("foto.jpg");
    expect(safeFileName("...", "image/png")).toBe("archivo.png");
  });
});
