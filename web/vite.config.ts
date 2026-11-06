import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // The site reads the reserved names list from ../script, outside this folder.
  server: { fs: { allow: [".."] } },
  test: { environment: "node" },
});
