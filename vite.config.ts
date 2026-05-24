/// <reference types="vitest" />
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  // Constrain vitest to unit tests under `tests/` only. The E2E suite at
  // `tests-e2e/` runs via Playwright (separate runner, real browser) and
  // must NOT be picked up by vitest — it imports @playwright/test which
  // breaks under vitest's environment.
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests-e2e/**", "node_modules/**", "dist/**"],
  },
});
