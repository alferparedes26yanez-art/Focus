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
- A syllabus may be called sílabo, sílabus, programa analítico, plan analítico, programa de asignatura, PEA, plan de curso, guía docente, guía didáctica, microcurrículo, plan de clases or cronograma. Any of these counts even if some sections are missing, and so does any document that lists a course's contents, units or schedule.
- Set is_syllabus to false only when the document does not describe how a course is organized (for example class slides, a book chapter, notes, an exam or something unrelated). Then explain in not_syllabus_reason, in one short sentence in Spanish, what the document seems to be, and leave every list empty.`;

  const instruction =
    input.imageCount > 1
      ? `The ${input.imageCount} images are the pages of one syllabus, in order. Extract its structure following the JSON schema.`
      : "Extract the structure of the attached syllabus following the JSON schema.";

  return { systemInstruction, instruction };
}

// ---------------------------------------------------------------------------
// Material library
// ---------------------------------------------------------------------------

export function pagesTranscriptionPrompt(input: { count: number; source: "pdf" | "photos" }) {
  const systemInstruction = `You transcribe a student's study material so it can be searched and cited.

Rules:
- Transcribe all readable text of each page in reading order, in its original language. Fix only obvious recognition errors.
- For diagrams, charts, formulas, tables or images that carry meaning, add a short description in Spanish in square brackets, e.g. [Diagrama: ciclo del agua con evaporación, condensación y precipitación].
- Do not add information that is not visible. Do not summarize.
- If a page has no readable content, return an empty text for it.`;

  const instruction =
    input.source === "pdf"
      ? `The attached PDF has ${input.count} page(s). Return one entry per page, with page numbered 1 to ${input.count} in order.`
      : `The ${input.count} attached image(s) are photos of study material (notes, board, book pages). Return one entry per image, with page numbered 1 to ${input.count} in the order given.`;

  return { systemInstruction, instruction };
}

export function videoTranscriptPrompt(input: { clipSeconds: number }) {
  const systemInstruction = `You transcribe class videos so a student can search them and jump to the right minute.

Rules:
- Transcribe what is said, in the original language, in segments of about 30 to 60 seconds.
- start_seconds is measured from the beginning of THIS clip (0 = start of the clip).
- When slides or the board show important text that is not said aloud, add it in square brackets: [En pantalla: ...].
- Do not summarize, translate or invent. If nobody speaks in the clip, set has_speech to false.`;

  return {
    systemInstruction,
    instruction: `Transcribe this clip of the video. It lasts up to ${input.clipSeconds} seconds.`,
  };
}

export function topicSuggestionPrompt(input: { title: string; excerpt: string; topics: string[] }) {
  const systemInstruction = `You file a student's study material under the syllabus topic it belongs to.

Rules:
- Choose the single topic that best matches the main content of the material.
- If the material covers the whole course or many units (e.g. a full textbook), or no topic fits, answer null.
- Base the decision only on the material's title and excerpt.`;

  const list = input.topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n");
  const instruction = `Material: "${input.title}"

Excerpt:
${input.excerpt}

Syllabus topics:
${list}

Answer with the number of the topic.`;

  return { systemInstruction, instruction };
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export type ChatMode = "simple" | "detailed" | "exam" | "tutor";

const CHAT_MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  simple:
    "Explain simply and briefly, as to a first-year student, with an everyday example. One or two short paragraphs.",
  detailed:
    "Explain in depth and in order: definition, how it works, examples and common mistakes. Use headings or lists when they help.",
  exam:
    "Answer like a model exam answer: precise terminology and the key points a teacher expects. End with two or three likely exam questions about it.",
  tutor:
    "Act as a Socratic tutor: do NOT give the full answer. Ask one or two guiding questions and give a hint grounded in the sources, so the student reasons it out. If the student answered a previous question, give feedback on it first.",
};

export function chatSystemPrompt(input: { subjectName: string; mode: ChatMode }) {
  return `You are the study assistant of the course "${input.subjectName}". Always answer in Spanish.

At the end of each user message you receive numbered excerpts from the student's own material ([1], [2], ...), each with its document and page, slide, section or minute.

Rules:
- Base the answer on those sources first. Cite them right after the sentence they support, with their numbers in square brackets, e.g. [2] or [1][3].
- Only cite numbers that appear in the list. Never invent documents, pages, minutes or quotes.
- Ignore sources that are not relevant to the question.
- If the sources do not contain the answer, say so clearly ("No encontré esto en tu material."). Then, only if it helps, answer from general knowledge in a separate paragraph that starts exactly with "**Conocimiento general:**" and has no source numbers.
- Use Markdown: short paragraphs, lists and bold for key terms. Do not add a reference list at the end; the app shows the sources.

Mode: ${CHAT_MODE_INSTRUCTIONS[input.mode]}`;
}

export function chatUserTurn(input: {
  question: string;
  sources: { n: number; label: string; content: string }[];
}) {
  const sources =
    input.sources.length > 0
      ? input.sources.map((source) => `[${source.n}] ${source.label}\n${source.content}`).join("\n\n")
      : "No relevant excerpts were found in the student's material for this question.";
  return `${input.question}

---
Sources from the student's material:
${sources}`;
}
