import { z } from "zod";

// Structured answers the AI returns while reading material.

export const pagesTranscriptSchema = z.object({
  pages: z.array(
    z.object({
      page: z.number().int().min(1).max(100).describe("1-based position of the page or image"),
      text: z.string(),
    }),
  ),
});

export const videoTranscriptSchema = z.object({
  has_speech: z.boolean(),
  segments: z.array(
    z.object({
      start_seconds: z.number().min(0).describe("Seconds from the start of this clip"),
      text: z.string(),
    }),
  ),
});

export const topicSuggestionSchema = z.object({
  topic_number: z.number().int().min(1).nullable().describe("Number of the chosen topic, or null"),
});
