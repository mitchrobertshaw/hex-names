// Saves the X profile picture of every person in src/data/featured.ts to public/avatars/, so the
// site serves the pictures itself: no third-party requests from visitors, nothing to rate-limit.
// Run it after adding someone to the featured names: npm run avatars
import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../src/data/featured.ts", import.meta.url), "utf8");
const handles = [...source.matchAll(/\bx:\s*"([A-Za-z0-9_]{1,15})"/g)].map((match) => match[1]);
const dir = new URL("../public/avatars/", import.meta.url);
await mkdir(dir, { recursive: true });

let failed = 0;
for (const handle of handles) {
  try {
    const response = await fetch(`https://unavatar.io/x/${handle}?fallback=false`);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) throw new Error(`got ${response.status} ${type}`);
    await writeFile(new URL(`${handle.toLowerCase()}.jpg`, dir), Buffer.from(await response.arrayBuffer()));
    console.log(`Saved @${handle}`);
  } catch (error) {
    failed += 1;
    console.error(`Could not get @${handle}'s picture: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
