import { useState } from "react";

import { youtubeEmbedUrl } from "../lib/youtube";

/**
 * A YouTube video that shows a still picture until the visitor presses play, then the player. The
 * page loads nothing from YouTube until then, so it stays quick, and the video starts at once.
 */
export function VideoFacade({ id, title, poster, length }: { id: string; title: string; poster: string; length: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="video">
      {playing ? (
        <iframe
          src={youtubeEmbedUrl(id, { autoplay: true })}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button className="video__start" type="button" onClick={() => setPlaying(true)} aria-label={`Play the video: ${title} (${length})`}>
          <img src={poster} alt="" width={1280} height={720} />
          <span className="video__play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
            </svg>
            Watch the demo <span className="video__length">{length}</span>
          </span>
        </button>
      )}
    </div>
  );
}
