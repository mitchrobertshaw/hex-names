// Makes the share pictures from share-image.html, 1200 x 630 pixels:
//   web/public/og-image.png          the one the website uses (light)
//   brand/hexns-share-image.png      the same, for posting by hand
//   brand/hexns-share-image-dark.png the dark version
// Needs Playwright with Chromium (npm install playwright, then npx playwright install chromium),
// and the website's fonts: run npm ci in web/ first. Then, from this folder: node render.cjs
const { chromium } = require("playwright");
const path = require("path");

const page = path.join(__dirname, "share-image.html");
const outputs = [
  { theme: "light", file: path.join(__dirname, "../../web/public/og-image.png") },
  { theme: "light", file: path.join(__dirname, "../hexns-share-image.png") },
  { theme: "dark", file: path.join(__dirname, "../hexns-share-image-dark.png") },
];

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const { theme, file } of outputs) {
    await tab.goto(`file://${page}`);
    await tab.evaluate((t) => {
      document.documentElement.className = t;
    }, theme);
    await tab.evaluate(() => document.fonts.ready);
    const fonts = await tab.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
    for (const family of ["Space Grotesk"]) {
      if (!fonts.includes(family)) throw new Error(`${family} didn't load: run npm ci in web/ first`);
    }
    const outside = await tab.evaluate(() =>
      [...document.querySelectorAll(".frame *")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.left < 0 || r.top < 0 || r.right > 1200 || r.bottom > 630;
      }),
    );
    if (outside) throw new Error("Something runs off the edge of the picture");
    await tab.screenshot({ path: file });
    console.log(`${path.relative(process.cwd(), file)} (${theme})`);
  }
  await browser.close();
})();
