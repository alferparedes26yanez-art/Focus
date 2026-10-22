import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { htmlToSections } from "./html";
import { pdfWithPages, readPdfPages } from "./pdf";
import { readPptxSlides } from "./pptx";
import { assertPublicUrl, isPrivateAddress, webPlaceholderTitle } from "./web";

async function makePdf(pages: string[]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage([400, 400]);
    if (text) page.drawText(text, { x: 40, y: 350, size: 12, font });
  }
  return Buffer.from(await pdf.save());
}

const slideXml = (texts: string[]) =>
  `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${texts
    .map((text) => `<p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`)
    .join("")}</p:spTree></p:cSld></p:sld>`;

async function makePptx(): Promise<Buffer> {
  const zip = new JSZip();
  // Slide files are named out of order on purpose: the order comes from
  // presentation.xml.
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`,
  );
  zip.file("ppt/slides/slide1.xml", slideXml(["Segunda diapositiva", "Regla de la cadena"]));
  zip.file("ppt/slides/slide2.xml", slideXml(["Primera diapositiva &amp; límites"]));
  zip.file(
    "ppt/slides/_rels/slide2.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`,
  );
  zip.file("ppt/notesSlides/notesSlide1.xml", slideXml(["Recordar el ejemplo del examen", "1"]));
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("readPdfPages", () => {
  it("reads the text of each page with its number", async () => {
    const buffer = await makePdf(["Introduccion al calculo", "", "Derivadas y regla de la cadena"]);
    const { totalPages, pages } = await readPdfPages(buffer, 2, 10);
    expect(totalPages).toBe(3);
    expect(pages.map((page) => page.page)).toEqual([2, 3]);
    expect(pages[0].text).toBe("");
    expect(pages[1].text).toContain("Derivadas y regla de la cadena");
  });

  it("builds a smaller PDF with some pages, in order", async () => {
    const buffer = await makePdf(["uno", "dos", "tres"]);
    const subset = await pdfWithPages(buffer, [3, 1]);
    const { totalPages, pages } = await readPdfPages(subset, 1, 2);
    expect(totalPages).toBe(2);
    expect(pages.map((page) => page.text)).toEqual(["tres", "uno"]);
  });
});

describe("readPptxSlides", () => {
  it("reads slides in presentation order, with speaker notes", async () => {
    const slides = await readPptxSlides(await makePptx());
    expect(slides.map((slide) => slide.slide)).toEqual([1, 2]);
    expect(slides[0].text).toContain("Primera diapositiva & límites");
    expect(slides[0].text).toContain("Notas del presentador: Recordar el ejemplo del examen");
    expect(slides[0].text).not.toMatch(/\n1$/);
    expect(slides[1].text).toContain("Regla de la cadena");
  });

  it("rejects files that are not presentations", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document/>");
    await expect(readPptxSlides(await zip.generateAsync({ type: "nodebuffer" }))).rejects.toThrow();
  });
});

describe("htmlToSections", () => {
  it("splits by headings and keeps table rows", () => {
    const sections = htmlToSections(
      "<p>Antes del título.</p><h2>Límites</h2><p>Un límite es…</p><table><tr><td>x</td><td>f(x)</td></tr></table><h3>Continuidad</h3><p>Una función es continua…</p>",
    );
    expect(sections.map((section) => section.section)).toEqual([null, "Límites", "Continuidad"]);
    expect(sections[1].text).toContain("x | f(x)");
  });
});

describe("web links", () => {
  it.each(["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"])(
    "treats %s as private",
    (address) => {
      expect(isPrivateAddress(address)).toBe(true);
    },
  );

  it.each(["8.8.8.8", "172.32.0.1", "2001:4860:4860::8888"])("treats %s as public", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it.each([
    "http://127.0.0.1/admin",
    "http://localhost:3000",
    "http://169.254.169.254/latest/meta-data",
    "ftp://example.com/file",
    "https://user:pass@93.184.215.14/",
    "http://93.184.215.14:8080/",
    "no es un enlace",
  ])("refuses %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toThrow();
  });

  it("accepts public addresses", async () => {
    await expect(assertPublicUrl("https://93.184.215.14/articulo")).resolves.toBeInstanceOf(URL);
  });

  it("names a link by its address until the page is read", () => {
    expect(webPlaceholderTitle("https://www.example.com/blog/derivadas")).toBe("example.com/blog/derivadas");
    expect(webPlaceholderTitle("https://es.wikipedia.org/")).toBe("es.wikipedia.org");
  });
});
