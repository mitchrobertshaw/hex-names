import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // The site reads the reserved names list from ../script, outside this folder.
  server: { fs: { allow: [".."] } },
  // The 3D scene (three.js) is its own file of about 600 kB, loaded after the page has appeared.
  build: { chunkSizeWarningLimit: 700 },
  test: { environment: "node" },
});
