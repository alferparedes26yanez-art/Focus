import type { NotebookNode } from "./document";

export type NotebookPageSummary = {
  id: string;
  title: string;
  class_date: string;
  topic_id: string | null;
  preview: string;
  updated_at: string;
};

export type NotebookPageView = {
  id: string;
  subject_id: string;
  title: string;
  class_date: string;
  topic_id: string | null;
  content: NotebookNode;
  updated_at: string;
};
