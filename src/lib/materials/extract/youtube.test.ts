import { describe, expect, it } from "vitest";

import { formatDuration, parseYoutubeId, toVideoSeconds, youtubeLinkAt } from "./youtube";

describe("parseYoutubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("reads %s", (url, id) => {
    expect(parseYoutubeId(url)).toBe(id);
  });

  it.each(["https://vimeo.com/123", "https://www.youtube.com/watch?v=short", "no es un enlace", "https://youtube.com/"])(
    "rejects %s",
    (url) => {
      expect(parseYoutubeId(url)).toBeNull();
    },
  );
});

describe("toVideoSeconds", () => {
  it("adds the clip start to times relative to the clip", () => {
    expect(toVideoSeconds([0, 45.6, 120], 300, 300)).toEqual([300, 345, 420]);
  });

  it("keeps times that already count from the start of the video", () => {
    expect(toVideoSeconds([310, 400, 590], 300, 300)).toEqual([310, 400, 590]);
  });

  it("keeps every time inside the clip", () => {
    expect(toVideoSeconds([-3, 299], 0, 120)).toEqual([0, 120]);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("links to a second of the video", () => {
    expect(youtubeLinkAt("dQw4w9WgXcQ", 90.7)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s");
  });
});
