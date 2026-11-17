// YouTube links for an embedded video.

/**
 * The player for a video, from youtube-nocookie.com, which sets no cookies until the video plays.
 * With `autoplay`, it starts at once: for a player that appears when the visitor presses play.
 */
export function youtubeEmbedUrl(id: string, { autoplay = false } = {}): string {
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params}`;
}

/** The video's page on YouTube. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}
