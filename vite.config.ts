/// <reference types="vitest" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import chromeManifest from "./src/manifest.json";
import { toSafariManifest } from "./src/manifest-targets";

// Build-target selector — THREE surfaces from ONE source tree + ONE core:
//
//   TARGET=chrome (default)  MV3 + native side panel  -> dist/        (Load unpacked)
//   TARGET=safari            MV3 + toolbar popup       -> dist-safari/ (safari-web-extension-converter)
//   TARGET=web               plain web page, no crxjs  -> dist-web/    (open in ANY browser, zero install)
//
// The Safari popup and the web page BOTH reuse the exact same sidepanel.html
// and src/lib core — there is no second UI and no forked logic. The core
// already falls back to in-memory storage + window.open when the chrome.*
// APIs are absent (see draft-history.ts / sidepanel.ts), so the web target
// "just works" as a normal page.
const TARGET = process.env.TARGET ?? "chrome";

export default defineConfig(() => {
  if (TARGET === "web") {
    // No crxjs: build/serve the side-panel UI as an ordinary web app so it
    // opens in Safari (or any browser) with zero install.
    return {
      root: "src",
      publicDir: false,
      base: "./",
      build: {
        outDir: "../dist-web",
        emptyOutDir: true,
        rollupOptions: { input: resolve(process.cwd(), "src/sidepanel.html") },
      },
    };
  }

  const isSafari = TARGET === "safari";
  const manifest = isSafari ? toSafariManifest(chromeManifest) : chromeManifest;

  return {
    plugins: [crx({ manifest: manifest as typeof chromeManifest })],
    build: {
      outDir: isSafari ? "dist-safari" : "dist",
      emptyOutDir: true,
    },
    // Constrain vitest to unit tests under `tests/` only. The E2E suite at
    // `tests-e2e/` runs via Playwright (separate runner, real browser) and
    // must NOT be picked up by vitest — it imports @playwright/test which
    // breaks under vitest's environment.
    test: {
      include: ["tests/**/*.test.ts"],
      exclude: [
        "tests-e2e/**",
        "node_modules/**",
        "dist/**",
        "dist-safari/**",
        "dist-web/**",
      ],
    },
  };
});
