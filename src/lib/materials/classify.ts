import "server-only";

import { generateJson } from "@/lib/ai/client";
import { topicSuggestionPrompt } from "@/lib/ai/prompts";
import type { ServerSupabase } from "@/lib/supabase/server";

import { topicSuggestionSchema } from "./schemas";

const MAX_EXCERPT_CHARS = 4000;

export type TopicOption = { id: string; label: string };

// The syllabus topics of a subject, in course order, labelled with their unit.
export async function loadTopicOptions(supabase: ServerSupabase, subjectId: string): Promise<TopicOption[]> {
  const { data, error } = await supabase
    .from("units")
    .select("title, position, topics(id, title, position)")
    .eq("subject_id", subjectId);
  if (error) throw new Error(error.message);

  return [...data]
    .sort((a, b) => a.position - b.position)
    .flatMap((unit) =>
      [...unit.topics]
        .sort((a, b) => a.position - b.position)
        .map((topic) => ({ id: topic.id, label: `${unit.title} › ${topic.title}` })),
    );
}

// Asks the AI which topic a material belongs to. null: the whole subject or
// no topic fits.
export async function suggestTopic(input: {
  userId: string;
  title: string;
  excerpt: string;
  topics: TopicOption[];
  deadline: number;
}): Promise<string | null> {
  const prompt = topicSuggestionPrompt({
    title: input.title,
    excerpt: input.excerpt.slice(0, MAX_EXCERPT_CHARS),
    topics: input.topics.map((topic) => topic.label),
  });
  const output = await generateJson({
    feature: "topic_suggestion",
    tier: "fast",
    userId: input.userId,
    schema: topicSuggestionSchema,
    systemInstruction: prompt.systemInstruction,
    parts: [{ text: prompt.instruction }],
    maxOutputTokens: 1024,
    deadline: input.deadline,
  });
  const number = output.topic_number;
  return number !== null && number <= input.topics.length ? input.topics[number - 1].id : null;
}

// Files a material that is waiting to be classified. Does nothing (returns
// false) while the subject has no syllabus topics, or if the student chose a
// topic in the meantime.
export async function classifyMaterial(input: {
  supabase: ServerSupabase;
  userId: string;
  material: { id: string; subject_id: string; title: string };
  excerpt: string;
  deadline: number;
  topics?: TopicOption[];
}): Promise<boolean> {
  const topics = input.topics ?? (await loadTopicOptions(input.supabase, input.material.subject_id));
  if (topics.length === 0 || !input.excerpt.trim()) return false;

  const topicId = await suggestTopic({
    userId: input.userId,
    title: input.material.title,
    excerpt: input.excerpt,
    topics,
    deadline: input.deadline,
  });

  const { error } = await input.supabase
    .from("materials")
    .update(topicId ? { topic_id: topicId, topic_source: "ai" } : { topic_id: null, topic_source: "general" })
    .eq("id", input.material.id)
    .eq("topic_source", "pending");
  if (error) throw new Error(error.message);
  return true;
}
