import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vitest/config";

// `npm run build` makes the site in dist/ for Netlify. `npm run build:single` makes the whole site
// as one HTML file in dist-single/, with the scripts, styles, fonts, pictures and 3D scene inside
// it, to share or open straight from a computer.
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    plugins: single ? [react(), viteSingleFile()] : [react()],
    // The site reads the reserved names list from ../script, outside this folder.
    server: { fs: { allow: [".."] } },
    build: single
      ? { outDir: "dist-single", chunkSizeWarningLimit: 4000 }
      : // The 3D scene (three.js) is its own file of about 600 kB, loaded after the page appears.
        { chunkSizeWarningLimit: 700 },
    test: { environment: "node" },
  };
});
