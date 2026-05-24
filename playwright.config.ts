// Playwright config — grip-post v0.1 E2E suite.
//
// Scope (per grip-post-depth11.md W8): smoke-test the BUILT side panel
// served via `vite preview`. Real Chrome MV3 extension loading is
// deferred to W11 dogfooding — Playwright's MV3-extension story is
// genuinely complex and V>>'s real-Chrome verification is the W11 anchor.
//
// Why a real http server (not file://): ES-module `<script type="module">`
// fails silently under file:// in Chromium — imports never resolve, the
// click handler never attaches, every test sees an empty output. Vite
// preview serves the built dist/ over http://, which the bundler-emitted
// module graph requires.
//
// What this suite DOES test:
//   - Dispatch table wires correctly through the side panel UI.
//   - Each transform button produces its expected output verbatim.
//   - History buttons round-trip through (in-memory) storage.
//
// What it does NOT test (deferred to W11 dogfood):
//   - Real chrome.storage.local persistence (unit suite covers).
//   - Background service-worker lifecycle.
//   - Content-script clipboard write on real LinkedIn.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  fullyParallel: false, // single worker since the webServer is shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    trace: "retain-on-failure",
  },
  // Serve dist/ via python's stdlib http.server. Avoids `vite preview` +
  // @crxjs interaction quirks (preview hanging without serving the bundle).
  // python3 is pre-installed on macOS, Ubuntu, and GitHub Actions runners.
  webServer: {
    command: "python3 -m http.server 4173 --directory dist",
    url: "http://localhost:4173/manifest.json",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
