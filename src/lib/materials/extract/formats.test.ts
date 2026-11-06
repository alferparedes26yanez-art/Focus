import { describe, expect, it } from "vitest";

import { planMaterials, resolveMaterialMime } from "../files";
import { charsetFromContentType, decodeText, sniffHtmlCharset } from "./decode";
import { readHtmlArticle } from "./html";
import { googleNotSharedMessage, LinkError, resolveDocumentLink } from "./links";
import { readTextSections } from "./text";
import { documentMimeOf, fileNameFromDisposition } from "./web";

const latin1 = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

describe("decodeText", () => {
  it("reads UTF-8, with or without a byte-order mark", () => {
    expect(decodeText(new TextEncoder().encode("límite"))).toBe("límite");
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("año")]))).toBe("año");
  });

  it("falls back to Windows-1252 when the bytes are not UTF-8", () => {
    expect(decodeText(latin1("función y límite"))).toBe("función y límite");
  });

  it("uses the charset the page declares", () => {
    const page = latin1('<html><head><meta charset="windows-1252"></head><body>Educación</body></html>');
    expect(sniffHtmlCharset(page)).toBe("windows-1252");
    expect(decodeText(page, sniffHtmlCharset(page))).toContain("Educación");
    expect(sniffHtmlCharset(latin1('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">'))).toBe("iso-8859-1");
    expect(charsetFromContentType("text/html; charset=UTF-8")).toBe("UTF-8");
  });
});

describe("readTextSections", () => {
  it("splits Markdown at its headings and cleans links and images", () => {
    const sections = readTextSections(
      "Intro breve\n\n# Normalización\nLa 1FN pide valores atómicos. ![diagrama](d.png)\n- Ver [guía](https://ej.com/g)\n\n## 2FN\nSin dependencias parciales.\n```\n# no es título\n```",
      { markdown: true },
    );
    expect(sections.map((section) => section.section)).toEqual([null, "Normalización", "2FN"]);
    expect(sections[1].text).toContain("• Ver guía (https://ej.com/g)");
    expect(sections[1].text).not.toContain("d.png");
    expect(sections[2].text).toContain("# no es título");
  });

  it("keeps plain text as one section", () => {
    expect(readTextSections("Línea 1\r\nLínea 2", { markdown: false })).toEqual([{ text: "Línea 1\nLínea 2", section: null }]);
    expect(readTextSections("   ", { markdown: false })).toEqual([]);
  });
});

describe("readHtmlArticle", () => {
  it("reads the content of a saved page without its menus", () => {
    const page = `<html><head><title>Tema 3 - Aula virtual</title></head><body>
      <nav><a href="/">Inicio</a><a href="/cursos">Mis cursos</a><a href="/perfil">Perfil</a></nav>
      <main><article><h1>Tema 3: Normalización</h1>
      <p>La normalización organiza las tablas de una base de datos para evitar redundancia y anomalías de actualización.</p>
      <h2>Primera forma normal</h2><p>Una tabla está en 1FN si todos sus atributos contienen valores atómicos y no hay grupos repetidos.</p>
      <h2>Segunda forma normal</h2><p>Está en 2FN si está en 1FN y cada atributo no clave depende de toda la clave primaria.</p>
      </article></main><footer>© Universidad</footer></body></html>`;
    const { title, sections } = readHtmlArticle(page);
    expect(title).toBeTruthy();
    expect(sections.map((section) => section.section)).toEqual(expect.arrayContaining(["Primera forma normal", "Segunda forma normal"]));
    expect(sections.map((section) => section.text).join(" ")).not.toContain("Mis cursos");
  });

  it("keeps short course pages made of lists and tables", () => {
    const page = `<html><body><h2>Comandos SQL</h2><ul><li>SELECT: consulta filas</li><li>INSERT: agrega filas</li></ul>
      <table><tr><td>DDL</td><td>CREATE, ALTER</td></tr><tr><td>DML</td><td>SELECT, UPDATE</td></tr></table></body></html>`;
    const text = readHtmlArticle(page).sections.map((section) => section.text).join("\n");
    expect(text).toContain("• SELECT: consulta filas");
    expect(text).toContain("DDL | CREATE, ALTER");
  });
});

describe("resolveDocumentLink", () => {
  it("turns Google Docs, Slides, Sheets and Drive links into downloads", () => {
    expect(resolveDocumentLink("https://docs.google.com/document/d/1AbCdEfGhIjKlMn/edit?usp=sharing")).toEqual({
      url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMn/export?format=pdf",
      google: "docs",
    });
    expect(resolveDocumentLink("https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn/edit#slide=id.p").url).toBe(
      "https://docs.google.com/presentation/d/1AbCdEfGhIjKlMn/export/pdf",
    );
    expect(resolveDocumentLink("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMn/edit").google).toBe("sheets");
    expect(resolveDocumentLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=drive_link").url).toBe(
      "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMn",
    );
    expect(resolveDocumentLink("https://drive.google.com/open?id=1AbCdEfGhIjKlMn").google).toBe("drive");
  });

  it("leaves published documents and other sites as they are", () => {
    const published = "https://docs.google.com/document/d/e/2PACX-1vQabc/pub";
    expect(resolveDocumentLink(published)).toEqual({ url: published, google: null });
    expect(resolveDocumentLink("https://ejemplo.com/clase.pdf")).toEqual({ url: "https://ejemplo.com/clase.pdf", google: null });
  });

  it("explains that folders must be shared file by file", () => {
    expect(() => resolveDocumentLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMn")).toThrow(LinkError);
  });

  it("tells how to share a private Google file", () => {
    expect(googleNotSharedMessage("drive")).toMatch(/Cualquier persona con el enlace/);
  });
});

describe("linked files", () => {
  const url = new URL("https://ejemplo.com/descargar?id=7");
  const bytes = new TextEncoder().encode("%PDF-1.7 ...");

  it("reads the file name a server sends", () => {
    expect(fileNameFromDisposition(`attachment; filename="Clase 3.pdf"; filename*=UTF-8''Clase%203%20%C3%ADndices.pdf`)).toBe("Clase 3 índices.pdf");
    expect(fileNameFromDisposition('inline; filename="tema.pptx"')).toBe("tema.pptx");
    expect(fileNameFromDisposition(null)).toBeNull();
  });

  it("recognizes documents by type, by name or by their bytes", () => {
    expect(documentMimeOf({ contentType: "application/pdf", fileName: null, url, bytes })).toBe("application/pdf");
    expect(
      documentMimeOf({ contentType: "application/octet-stream", fileName: "tema.pptx", url, bytes: new Uint8Array([0x50, 0x4b]) }),
    ).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(documentMimeOf({ contentType: "application/octet-stream", fileName: null, url, bytes })).toBe("application/pdf");
    expect(documentMimeOf({ contentType: "text/html; charset=utf-8", fileName: null, url, bytes: new TextEncoder().encode("<html>") })).toBeNull();
  });
});

describe("text files in the library", () => {
  it("accepts .html, .txt and .md with or without a browser type", () => {
    expect(resolveMaterialMime({ name: "tema.md", type: "text/plain" })).toBe("text/markdown");
    expect(resolveMaterialMime({ name: "clase.HTM", type: "" })).toBe("text/html");
    const plan = planMaterials(
      [
        { name: "guia.html", size: 2000, type: "text/html" },
        { name: "notas.txt", size: 100, type: "text/plain" },
      ],
      { groupPhotos: true },
    );
    expect(plan.ok && plan.materials.map((material) => [material.kind, material.title])).toEqual([
      ["html", "guia"],
      ["text", "notas"],
    ]);
  });

  it("limits text files to 10 MB", () => {
    expect(planMaterials([{ name: "enorme.txt", size: 11 * 1024 * 1024, type: "text/plain" }], { groupPhotos: true })).toMatchObject({
      ok: false,
    });
  });
});
