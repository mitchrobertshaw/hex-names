# The HexNS promo video

A 28-second square video for X, drawn in code so its timing can follow the voiceover exactly.

- [`storyboard.html`](storyboard.html) is the storyboard: each scene's frame, voice line, motion and
  sound, a playable animatic, the ElevenLabs script, and the X profile kit. Open it in a browser.
- Every frame comes from one function of time, `render(t)`, so the storyboard's frames, the
  animatic and the final video are the same drawing. The timings are at the top of its script;
  timing the video to a recording means moving those numbers.
- `storyboard.html?stage` shows only the 1080 × 1080 frame and exposes `window.HexPromo`
  (`ready`, `render(t)` and `duration`), for rendering the video one frame at a time.

The X profile picture, header and bio are in [`brand/x/`](../brand/x/README.md).
