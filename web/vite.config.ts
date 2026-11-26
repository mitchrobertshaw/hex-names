import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vitest/config";

// `npm run build` makes the site in dist/ for Netlify. `npm run build:single` makes the whole site
// as one HTML file in dist-single/, with the scripts, styles, fonts and pictures inside it, to
// share or open straight from a computer.
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    plugins: single ? [react(), viteSingleFile()] : [react()],
    // The site reads the reserved names list from ../script, outside this folder.
    server: { fs: { allow: [".."] } },
    // Three pages: the homepage, the app (app.hexns.domains, or /app on a preview link), and
    // /metamask, the unlisted page for the PulseChain Names snap and its video.
    build: single
      ? { outDir: "dist-single", chunkSizeWarningLimit: 4000 }
      : { rollupOptions: { input: { main: "index.html", app: "app/index.html", metamask: "metamask/index.html" } } },
    test: { environment: "node" },
  };
});
