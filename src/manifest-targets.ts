/**
 * Per-browser manifest derivation.
 *
 * The canonical manifest (src/manifest.json) is Chrome MV3 with a native side
 * panel. Safari has NO side-panel API, so the Safari target swaps the side
 * panel for a toolbar popup that points at the SAME sidepanel.html — no second
 * UI, no core changes. Everything else (content scripts, context menus,
 * storage, icons, action) is identical, so the two targets cannot silently
 * diverge — the branched manifest is the only difference.
 *
 * Kept as a pure function (not inlined in vite.config) so it is unit-testable
 * and both the build and the tests derive the Safari manifest the same way.
 */

/** The subset of MV3 manifest fields this derivation reads or rewrites. */
export interface WebExtManifest {
  permissions?: string[];
  side_panel?: { default_path: string };
  action?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Derive the Safari manifest from the Chrome manifest:
 *  - remove the `side_panel` key (Safari rejects the unknown key),
 *  - remove the `sidePanel` permission (Safari cannot grant it),
 *  - give the toolbar `action` a `default_popup` pointing at the SAME
 *    sidepanel.html the Chrome side panel uses.
 *
 * The popup path is taken from the Chrome `side_panel.default_path` so the two
 * targets can never point at different HTML.
 */
export function toSafariManifest<T extends WebExtManifest>(
  chrome: T,
): WebExtManifest {
  const { side_panel, permissions, action, ...rest } = chrome;
  const popupPath = side_panel?.default_path ?? "src/sidepanel.html";
  return {
    ...rest,
    permissions: (permissions ?? []).filter((p) => p !== "sidePanel"),
    action: { ...(action ?? {}), default_popup: popupPath },
  };
}
