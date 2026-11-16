// Renders the promo video: every frame of storyboard.html (?stage), over its soundtrack, into a
// 1080 × 1080 MP4 for X. Needs Playwright's Chromium and ffmpeg.
//
//   node promo/render.cjs [out.mp4] [fps]    the video (about 13 minutes)
//   node promo/render.cjs --soundtrack       only the soundtrack, also written into storyboard.html
//                                            so its player plays exactly what the video will
//
// The soundtrack is built first: the voice cut and placed as the page says (HexPromo.voice), the
// music edit below under it, dipping while the voice speaks, and the mix brought to -14 LUFS with a
// single gain change. Frames then go straight into ffmpeg; nothing else is written to disk.
const { chromium } = require("playwright");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const soundtrackOnly = args.includes("--soundtrack");
const [outArg, fpsArg] = args.filter((a) => !a.startsWith("--"));
const out = outArg || path.join(__dirname, "out", "hexns-promo.mp4");
const fps = Number(fpsArg || 60);
const VOICE = path.join(__dirname, "voiceover.mp3");
const MUSIC_FILE = path.join(__dirname, "music.mp3");
const SOUNDTRACK = path.join(__dirname, "out", "soundtrack.wav");

// The music: "Deep Documentary" by aktasok (music.mp3), edited to fit. It hits on every bar, every
// 3.116 s. The first piece is placed so its first hit lands at 0.82 s, and the edit jumps, on a bar
// line (22.63 s), to the track's own ending, so its last hit lands as the logo draws (25.75 s) and it
// decays to silence as the video ends. Retime these if the voice moves the logo.
const MUSIC = {
  gain: -20, // dB: about 15 dB under the voice, and 5 dB more while it speaks
  parts: [ // from, to (seconds in music.mp3), where it starts in the video, fade in, fade out, extra dB
    [11.8, 34.7, 0.0, 0.4, 0.3, 0],
    [118.4, 126.6, 22.47, 0.12, 0, 5], // the track's ending is quieter than its build: lift it so the last hit lands
  ],
};

const ms = (s) => Math.round(s * 1000);
function ffmpeg(argv) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...argv], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.slice(-2000));
  return r.stderr;
}

// Built in plain steps, each cut to the video's length with -t: one large graph of these filters
// cut the sound short (ffmpeg's ducking stops when its key does).
function buildSoundtrack(duration, pieces) {
  fs.mkdirSync(path.dirname(SOUNDTRACK), { recursive: true });
  const tmp = (name) => SOUNDTRACK.replace(/soundtrack\.wav$/, `soundtrack-${name}.wav`);
  const len = ["-t", String(duration), "-c:a", "pcm_s24le"];
  const fmt = "aformat=sample_rates=48000:channel_layouts=stereo";
  // 1. The voice: each piece cut (8 ms fades at the cuts) and moved to where it starts.
  ffmpeg(["-y", "-i", VOICE, "-filter_complex",
    pieces.map(([a, b, at], i) =>
      `[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${(b - a - 0.008).toFixed(3)}:d=0.008,adelay=${ms(at)}:all=1[v${i}]`).join(";") +
    `;${pieces.map((_, i) => `[v${i}]`).join("")}amix=inputs=${pieces.length}:normalize=0,${fmt},apad[o]`,
    "-map", "[o]", ...len, tmp("voice")]);
  // 2. The music edit, at its level.
  ffmpeg(["-y", "-i", MUSIC_FILE, "-filter_complex",
    MUSIC.parts.map(([a, b, at, fin, fout, extra], i) =>
      `[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS` + (fin ? `,afade=t=in:d=${fin}` : "") +
      (fout ? `,afade=t=out:st=${(b - a - fout).toFixed(3)}:d=${fout}` : "") +
      `,volume=${MUSIC.gain + extra}dB,adelay=${ms(at)}:all=1[m${i}]`).join(";") +
    `;${MUSIC.parts.map((_, i) => `[m${i}]`).join("")}amix=inputs=${MUSIC.parts.length}:normalize=0,${fmt},apad[o]`,
    "-map", "[o]", ...len, tmp("music")]);
  // 3. The music dips while the voice speaks, and the two are mixed, with a short fade at the very end.
  ffmpeg(["-y", "-i", tmp("music"), "-i", tmp("voice"), "-filter_complex",
    `[0:a][1:a]sidechaincompress=threshold=0.04:ratio=3:attack=20:release=350[ducked];` +
    `[1:a][ducked]amix=inputs=2:normalize=0,afade=t=out:st=${duration - 0.3}:d=0.3[o]`,
    "-map", "[o]", ...len, tmp("mix")]);
  // 4. Measure the mix, then one exact gain to -14 LUFS (peaks kept under -1.5 dBTP).
  const m = JSON.parse(ffmpeg(["-i", tmp("mix"), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]).match(/\{[\s\S]*?\}/)[0]);
  ffmpeg(["-y", "-i", tmp("mix"), "-af",
    `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset},aresample=48000`,
    ...len, SOUNDTRACK]);
  for (const name of ["voice", "music", "mix"]) fs.unlinkSync(tmp(name));
}

(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("file://" + path.join(__dirname, "storyboard.html") + "?stage", { waitUntil: "networkidle" });
  const { duration, voice: pieces } = await page.evaluate(async () => {
    await window.HexPromo.ready;
    return { duration: window.HexPromo.duration, voice: window.HexPromo.voice };
  });

  buildSoundtrack(duration, pieces);
  console.log(`soundtrack: ${SOUNDTRACK}`);

  if (soundtrackOnly) {
    // The page's player plays this, so it sounds exactly like the video.
    const mp3 = SOUNDTRACK.replace(/\.wav$/, ".mp3");
    ffmpeg(["-y", "-i", SOUNDTRACK, "-c:a", "libmp3lame", "-b:a", "128k", mp3]);
    const html = path.join(__dirname, "storyboard.html");
    const b64 = fs.readFileSync(mp3).toString("base64");
    const before = fs.readFileSync(html, "utf8");
    const after = before.replace(/const SOUNDTRACK_MP3 = "[A-Za-z0-9+/=]*";/, () => `const SOUNDTRACK_MP3 = "${b64}";`);
    if (after === before) throw new Error("storyboard.html has no SOUNDTRACK_MP3 to replace");
    fs.writeFileSync(html, after);
    console.log("written into storyboard.html");
    await browser.close();
    return;
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-i", SOUNDTRACK, "-map", "0:v", "-map", "1:a", "-shortest",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps),
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  const frames = Math.round(duration * fps);
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((T) => window.HexPromo.render(T), f / fps);
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % (fps * 2) === 0) console.log(`frame ${f} / ${frames} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  const code = await new Promise((r) => ff.on("close", r));
  await browser.close();
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  console.log(`done: ${out} (${frames} frames, ${((Date.now() - started) / 1000).toFixed(0)} s)`);
})().catch((e) => { console.error(e); process.exit(1); });
