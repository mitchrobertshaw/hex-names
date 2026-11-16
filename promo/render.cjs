// Renders the promo video: every frame of storyboard.html (?stage), with the voiceover, into a
// 1080 × 1080 MP4 for X. Needs Playwright's Chromium and ffmpeg.
//
//   node promo/render.cjs [out.mp4] [fps]
//
// Frames go straight into ffmpeg, nothing is written to disk. The voice is placed where the page
// says (HexPromo.audioAt) and brought to -14 LUFS with a single gain change, so the narrator's
// dynamics stay as recorded.
const { chromium } = require("playwright");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const out = process.argv[2] || path.join(__dirname, "out", "hexns-promo.mp4");
const fps = Number(process.argv[3] || 60);
const voice = path.join(__dirname, "voiceover.mp3");

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // First pass: measure the recording (ffmpeg prints it to stderr), so the second applies one exact gain.
  const pass1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", voice, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const measured = JSON.parse(pass1.stderr.match(/\{[\s\S]*?\}/)[0]);

  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto("file://" + path.join(__dirname, "storyboard.html") + "?stage", { waitUntil: "networkidle" });
  const { duration, audioAt } = await page.evaluate(async () => {
    await window.HexPromo.ready;
    return { duration: window.HexPromo.duration, audioAt: window.HexPromo.audioAt };
  });

  const m = measured;
  const audio = `[1:a]adelay=${Math.round(audioAt * 1000)}:all=1,` +
    `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset},` +
    `aresample=48000,apad[a]`;
  const ff = spawn("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-i", voice,
    "-filter_complex", audio, "-map", "0:v", "-map", "[a]", "-shortest",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps),
    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-movflags", "+faststart", out,
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
