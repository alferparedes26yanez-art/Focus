import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerSupabase } from "@/lib/supabase/server";

import { indexNotebookPage } from "./index-page";

const ai = vi.hoisted(() => ({
  embedTexts: vi.fn(async ({ texts }: { texts: string[] }) => texts.map(() => new Array(768).fill(0.1))),
}));
vi.mock("@/lib/ai/client", () => ai);

function fakeSupabase(page: Record<string, unknown> | null, material: { content_hash: string } | null) {
  const rpc = vi.fn(async () => ({ error: null }));
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: table === "notebook_pages" ? page : material, error: null }),
    };
    return chain;
  };
  return { client: { from, rpc } as unknown as ServerSupabase, rpc };
}

const page = {
  id: "p1",
  title: "Normalización",
  class_date: "2026-11-06",
  topic_id: null,
  content: {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "1FN" }] },
      { type: "paragraph", content: [{ type: "text", text: "Valores atómicos." }] },
    ],
  },
};

const run = (client: ServerSupabase) =>
  indexNotebookPage({ supabase: client, userId: "u1", pageId: "p1", deadline: Date.now() + 20_000 });

beforeEach(() => {
  ai.embedTexts.mockClear();
});

describe("indexNotebookPage", () => {
  it("indexes the page with its title and sections", async () => {
    const { client, rpc } = fakeSupabase(page, null);
    expect(await run(client)).toEqual({ status: "indexed", chunks: 1 });
    expect(ai.embedTexts.mock.calls[0][0].texts).toEqual(["Apuntes del 6 nov · Normalización — 1FN\n\nValores atómicos."]);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(name).toBe("index_notebook_page");
    expect(args).toMatchObject({ p_page_id: "p1", p_title: "Apuntes del 6 nov · Normalización" });
    expect(args.p_chunks).toEqual([expect.objectContaining({ content: "Valores atómicos.", section: "1FN" })]);
  });

  it("does nothing when the page did not change", async () => {
    const first = fakeSupabase(page, null);
    await run(first.client);
    const hash = (first.rpc.mock.calls[0] as unknown as [string, { p_content_hash: string }])[1].p_content_hash;

    const { client, rpc } = fakeSupabase(page, { content_hash: hash });
    expect(await run(client)).toEqual({ status: "unchanged", chunks: 1 });
    expect(rpc).not.toHaveBeenCalled();
    expect(ai.embedTexts).toHaveBeenCalledTimes(1);
  });

  it("skips an empty page that was never indexed, and removes one that was", async () => {
    const empty = { ...page, content: { type: "doc", content: [{ type: "paragraph" }] } };
    const never = fakeSupabase(empty, null);
    expect(await run(never.client)).toEqual({ status: "empty", chunks: 0 });
    expect(never.rpc).not.toHaveBeenCalled();

    const before = fakeSupabase(empty, { content_hash: "old" });
    expect(await run(before.client)).toEqual({ status: "empty", chunks: 0 });
    expect((before.rpc.mock.calls[0] as unknown as [string, { p_chunks: unknown[] }])[1].p_chunks).toEqual([]);
  });

  it("returns null for a page that does not exist", async () => {
    expect(await run(fakeSupabase(null, null).client)).toBeNull();
  });
});
