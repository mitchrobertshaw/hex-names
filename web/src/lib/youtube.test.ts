import { describe, expect, it } from "vitest";

import { youtubeEmbedUrl, youtubeWatchUrl } from "./youtube";

describe("youtube links", () => {
  it("embeds from youtube-nocookie.com, without other channels' videos at the end", () => {
    expect(youtubeEmbedUrl("gubE6BTv6j0")).toBe("https://www.youtube-nocookie.com/embed/gubE6BTv6j0?rel=0&playsinline=1");
  });

  it("starts at once when asked", () => {
    expect(youtubeEmbedUrl("gubE6BTv6j0", { autoplay: true })).toBe(
      "https://www.youtube-nocookie.com/embed/gubE6BTv6j0?rel=0&playsinline=1&autoplay=1",
    );
  });

  it("links to the video on YouTube", () => {
    expect(youtubeWatchUrl("gubE6BTv6j0")).toBe("https://www.youtube.com/watch?v=gubE6BTv6j0");
  });

  it("escapes an id that isn't a plain YouTube id", () => {
    expect(youtubeEmbedUrl("a/b?c")).toBe("https://www.youtube-nocookie.com/embed/a%2Fb%3Fc?rel=0&playsinline=1");
  });
});
