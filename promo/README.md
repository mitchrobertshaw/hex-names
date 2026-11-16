# The HexNS promo video

A 25-second square video for X, drawn in code and timed to its voiceover.

- [`storyboard.html`](storyboard.html) is the storyboard: each scene's frame, voice line, motion and
  sound, a player that plays it with the voice, the ElevenLabs script, and the X profile kit. Open
  it in a browser.
- Every frame comes from one function of time, `render(t)`, so the storyboard's frames, the player
  and the final video are the same drawing.
- The scenes are drawn on a design clock. The voiceover sets the real one: `SAID` in the script
  pins each on-screen word to the moment it's said, and time between pins stretches. For a new
  recording, update `SAID` (and `VO`, for the captions) from its word timings.
- [`voiceover.mp3`](voiceover.mp3) is the recording, made with ElevenLabs.
- `node promo/render.cjs` renders the 1080 × 1080, 60 fps MP4 with the voice into `promo/out/`
  (about 11 minutes). It needs Playwright's Chromium and ffmpeg. `storyboard.html?stage` shows
  only the frame and exposes `window.HexPromo` (`ready`, `render(t)`, `duration` and `audioAt`).
- [`endcards.html`](endcards.html) holds the five end cards that were considered; the video uses C,
  the name card.

The HEX logo it shows, and where it came from, are in [`assets/`](assets/README.md). The X
profile picture, header and bio are in [`brand/x/`](../brand/x/README.md).
