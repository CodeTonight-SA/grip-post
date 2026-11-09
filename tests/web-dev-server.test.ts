import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserConfig, UserConfigExport } from "vite";

// `npm run dev:web` serves the side panel as a plain web page. Its address must
// be fixed: 127.0.0.1 (never an IPv6-only bind) on port 7678, and strictPort so
// a busy port stops the server instead of moving it to a URL nobody bookmarked.
//
// vite.config.ts is outside tsconfig's include because it needs Node types, so
// the test loads it at run time with vi.importActual rather than a static import.
describe("web target dev server", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("serves on 127.0.0.1:7678 and refuses a busy port", async () => {
    vi.stubEnv("TARGET", "web");
    const { default: config } = await vi.importActual<{ default: UserConfigExport }>("../vite.config");
    const env = { command: "serve", mode: "development" } as const;
    const web = (typeof config === "function" ? await config(env) : await config) as UserConfig;
    expect(web.server).toEqual({ host: "127.0.0.1", port: 7678, strictPort: true });
  });
});
