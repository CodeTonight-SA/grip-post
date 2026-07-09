import { describe, it, expect } from "vitest";
import { toSafariManifest, type WebExtManifest } from "../src/manifest-targets";
import chromeManifest from "../src/manifest.json";

// Goodhart-resistant: these assert the ACTUAL derived values, so the test
// fails if the transform stops dropping the Chrome-only keys or stops reusing
// the shared sidepanel.html. It also pins the invariant that the two targets
// cannot diverge on anything except the side-panel-vs-popup surface.
describe("toSafariManifest", () => {
  const chrome = chromeManifest as unknown as WebExtManifest;
  const safari = toSafariManifest(chrome);

  it("the Chrome manifest actually has the side_panel key (guards the premise)", () => {
    expect(chrome.side_panel).toBeDefined();
    expect(chrome.permissions).toContain("sidePanel");
  });

  it("drops the Chrome-only side_panel key Safari rejects", () => {
    expect(safari.side_panel).toBeUndefined();
  });

  it("drops the sidePanel permission Safari cannot grant", () => {
    expect(safari.permissions).not.toContain("sidePanel");
  });

  it("keeps every other permission untouched", () => {
    expect(safari.permissions).toContain("contextMenus");
    expect(safari.permissions).toContain("storage");
    expect(safari.permissions).toHaveLength(
      (chrome.permissions?.length ?? 0) - 1,
    );
  });

  it("reuses the SAME sidepanel.html as the toolbar popup", () => {
    expect(safari.action?.default_popup).toBe(
      chrome.side_panel?.default_path,
    );
    expect(safari.action?.default_popup).toBe("src/sidepanel.html");
  });

  it("preserves the shared surface (name, version, content_scripts, icons)", () => {
    expect(safari.name).toBe(chrome.name);
    expect(safari.version).toBe(chrome.version);
    expect(safari.content_scripts).toEqual(chrome.content_scripts);
    expect(safari.icons).toEqual(chrome.icons);
  });

  it("does not mutate the input manifest", () => {
    expect(chrome.side_panel).toBeDefined();
    expect(chrome.permissions).toContain("sidePanel");
  });
});
