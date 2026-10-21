// All AI prompts live in this file.

export function syllabusExtractionPrompt(input: { today: string; timeZone: string; imageCount: number }) {
  const systemInstruction = `You extract the structure of a university course syllabus so a student can review it before saving it.

Rules:
- Use only information that is in the document. Never invent units, topics, dates, weights, people or references. When something is not in the document, use null or an empty list.
- Keep every text in the document's original language and wording. Do not translate or summarize titles; only fix obvious OCR errors.
- units: the course content in the order it appears. A unit is a top-level block (Unidad, Capítulo, Módulo, Bloque, Parcial...). topics are the items inside it, in order. If there is a third level, put it in the topic's "details". If the document only has a flat list of topics, group them under the headings it uses, or use one unit named after the content section.
- events: every graded activity or key date: exams (parcial, final, supletorio, recuperación), quizzes (lecciones, pruebas cortas), assignments (deberes, tareas, talleres, informes), projects and presentations (exposiciones). Also graded components without a date (participación, asistencia, portafolio) with date null.
- Dates: today is ${input.today} (time zone ${input.timeZone}). Write "date" as YYYY-MM-DD only when the document gives the day and the month. If the year is missing, infer it from the academic period (or the nearest matching date after the period starts) and add a warning saying the year was inferred. If only a week number or a relative reference is given ("semana 8", "al final de la unidad 2"), set date to null and copy that text to date_text.
- weight_percent: percentage of the final grade. Convert points to a percentage only when the total is clear (for example 2 out of 10 points is 20). Otherwise null.
- unit_numbers: 1-based positions in your units list of the units an evaluation covers, only when the document says which content it covers.
- bibliography: one entry per reference as a single citation string; kind is "basic" or "complementary" only when the document classifies it.
- warnings: at most 8 short notes in Spanish about anything ambiguous the student should check. Empty when everything is clear.
- If the document is not a syllabus or course program, set is_syllabus to false and leave every list empty.`;

  const instruction =
    input.imageCount > 1
      ? `The ${input.imageCount} images are the pages of one syllabus, in order. Extract its structure following the JSON schema.`
      : "Extract the structure of the attached syllabus following the JSON schema.";

  return { systemInstruction, instruction };
}
