// grip-post side panel — delegates to the shared dispatch in unicode-toolkit
// for transforms, and to draft-history for the local persistence buttons.
// Two attribute namespaces:
//   - data-transform="<TransformKey>"   → input → dispatch(key, text) → output
//   - data-action="save-draft|view-history|clear-history"
//                                       → side-effect against chrome.storage.local
//
// Adding a new transform = a new HTML button with `data-transform`, then add
// the key to VALID_KEYS below. Adding a new action = case in handleAction.

import { dispatch, type TransformKey } from "./lib/unicode-toolkit";
import {
  saveDraft,
  getDrafts,
  clearDrafts,
  defaultStorage,
  type DraftEntry,
} from "./lib/draft-history";

const input = document.getElementById("input") as HTMLTextAreaElement | null;
const output = document.getElementById("output") as HTMLElement | null;

// Hoist storage to module scope so save/view/clear share the same backend.
// In a real Chrome extension this returns `chrome.storage.local` (shared
// state by definition); in dev/test environments without chrome it returns
// an in-memory Map. Without hoisting, each call would build a FRESH Map
// and drafts would silently never round-trip — caught by E2E save→view test.
const storage = defaultStorage();

const VALID_KEYS: ReadonlySet<TransformKey> = new Set<TransformKey>([
  "bold",
  "italic",
  "brackets",
  "hr",
  "arrow",
  "handles",
  "diamond",
  "check",
  "strip-tells",
  "ground-check",
]);

const VALID_ACTIONS = new Set([
  "save-draft",
  "view-history",
  "clear-history",
]);

function setOutput(text: string): void {
  if (output) output.textContent = text;
}

/** Format a draft list for the output panel — newest first, ISO timestamps. */
function formatDrafts(drafts: readonly DraftEntry[]): string {
  if (drafts.length === 0) return "No drafts saved yet.";
  const lines: string[] = [`${drafts.length} draft(s):`, ""];
  for (const d of drafts) {
    const ts = new Date(d.savedAt).toISOString();
    const preview = d.text.length > 60 ? d.text.slice(0, 57) + "..." : d.text;
    lines.push(`[${ts}] ${preview}`);
  }
  return lines.join("\n");
}

async function handleAction(action: string): Promise<void> {
  const text = input?.value ?? "";
  switch (action) {
    case "save-draft": {
      try {
        const entry = await saveDraft(text, storage);
        setOutput(
          `Saved draft ${entry.id} at ${new Date(entry.savedAt).toISOString()}.`,
        );
      } catch (err) {
        setOutput(`Save failed: ${(err as Error).message}`);
      }
      return;
    }
    case "view-history": {
      const drafts = await getDrafts(storage);
      setOutput(formatDrafts(drafts));
      return;
    }
    case "clear-history": {
      await clearDrafts(storage);
      setOutput("Cleared all drafts.");
      return;
    }
  }
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const transform = target.dataset?.transform;
  const action = target.dataset?.action;
  if (transform && VALID_KEYS.has(transform as TransformKey)) {
    const text = input?.value ?? "";
    setOutput(dispatch(transform as TransformKey, text));
    return;
  }
  if (action && VALID_ACTIONS.has(action)) {
    void handleAction(action);
    return;
  }
});
