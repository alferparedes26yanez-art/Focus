// YouTube links: video id, title and duration. The transcript itself comes
// from Gemini (see process.ts).

export const MAX_VIDEO_SECONDS = 60 * 60;
export const VIDEO_SEGMENT_SECONDS = 5 * 60;

export function parseYoutubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeLinkAt(id: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${id}&t=${Math.max(0, Math.floor(seconds))}s`;
}

// Transcript times are asked relative to the clip, but Gemini sometimes
// measures them from the start of the video; both become video seconds.
export function toVideoSeconds(starts: number[], clipStart: number, clipSeconds: number): number[] {
  const absolute = clipStart > 0 && starts.some((start) => start > clipSeconds + 5);
  return starts.map((start) => {
    const seconds = Math.floor(absolute ? start : clipStart + start);
    return Math.min(Math.max(seconds, clipStart), clipStart + clipSeconds);
  });
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(secs)}` : `${minutes}:${two(secs)}`;
}

export async function fetchYoutubeInfo(id: string): Promise<{ title: string | null; durationSeconds: number | null }> {
  const watch = youtubeWatchUrl(id);
  let title: string | null = null;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error("not_public");
    }
    if (response.ok) title = ((await response.json()) as { title?: string }).title ?? null;
  } catch (error) {
    if (error instanceof Error && error.message === "not_public") throw error;
  }

  let durationSeconds: number | null = null;
  try {
    const response = await fetch(watch, {
      signal: AbortSignal.timeout(8_000),
      headers: { "accept-language": "es,en;q=0.8", "user-agent": "Mozilla/5.0" },
    });
    const html = await response.text();
    const match = /"lengthSeconds":"(\d+)"/.exec(html) ?? /itemprop="duration" content="PT(?:(\d+)H)?(\d+)M(\d+)S"/.exec(html);
    if (match && match.length === 2) durationSeconds = Number(match[1]);
    else if (match) durationSeconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  } catch {
    durationSeconds = null;
  }
  return { title, durationSeconds: durationSeconds && durationSeconds > 0 ? durationSeconds : null };
}
