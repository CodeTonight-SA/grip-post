// grip-post side panel — delegates to the shared dispatch in unicode-toolkit
// for transforms, draft-history for local persistence, licence for Pro
// gating, and polar for the checkout URL.
// Two attribute namespaces:
//   - data-transform="<TransformKey>"   → input → dispatch(key, text) → output
//   - data-action="save-draft|view-history|clear-history|
//                  buy-pro|save-licence|check-licence|clear-licence"
//                                       → side-effect against storage / window
//
// Adding a new transform = HTML button + add key to VALID_KEYS.
// Adding a new action = HTML button + case in handleAction.

import { dispatch, type TransformKey } from "./lib/unicode-toolkit";
import {
  saveDraft,
  getDrafts,
  clearDrafts,
  defaultStorage,
  type DraftEntry,
} from "./lib/draft-history";
import {
  saveLicence,
  getLicence,
  clearLicence,
  hasProLicence,
} from "./lib/licence";
import { buildCheckoutUrl } from "./lib/polar";
import {
  bump,
  getStats,
  resetStats,
  formatStats,
  type StatEvent,
} from "./lib/telemetry";
import { gatherReceipt, formatReceipt } from "./lib/receipt";

const input = document.getElementById("input") as HTMLTextAreaElement | null;
const output = document.getElementById("output") as HTMLElement | null;
const licenceInput = document.getElementById(
  "licence-input",
) as HTMLInputElement | null;

// Hoist storage to module scope so save/view/clear share the same backend.
// In a real Chrome extension this returns `chrome.storage.local` (shared
// state by definition); in dev/test environments without chrome it returns
// an in-memory Map. Without hoisting, each call would build a FRESH Map
// and drafts would silently never round-trip — caught by E2E save→view test.
const storage = defaultStorage();

// The last receipt rendered, so "Copy receipt" can re-emit it. Module-scope
// for the same reason `storage` is hoisted — shared across click handlers.
let lastReceipt = "";

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
  "buy-pro",
  "save-licence",
  "check-licence",
  "clear-licence",
  "show-stats",
  "reset-stats",
  "receipt",
  "copy-receipt",
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

/** Today as YYYY-MM-DD — the impure clock the pure receipt builder needs. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Extension version from the manifest; dev fallback keeps the receipt sane. */
function extensionVersion(): string {
  const g = globalThis as unknown as {
    chrome?: { runtime?: { getManifest?: () => { version?: string } } };
  };
  return g.chrome?.runtime?.getManifest?.().version ?? "0.1.1";
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
    case "buy-pro": {
      const url = buildCheckoutUrl({ source: "sidepanel" });
      // chrome.tabs is only available in the extension context. In dev/test
      // (file:// or local server), fall back to window.open so the button
      // still works for E2E verification.
      const g = globalThis as unknown as {
        chrome?: { tabs?: { create?: (opts: { url: string }) => void } };
      };
      if (g.chrome?.tabs?.create) {
        g.chrome.tabs.create({ url });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      setOutput(`Opening Polar checkout: ${url}`);
      return;
    }
    case "save-licence": {
      const raw = licenceInput?.value ?? "";
      try {
        const saved = await saveLicence(raw, storage);
        if (licenceInput) licenceInput.value = "";
        setOutput(`Licence saved: ${saved.slice(0, 24)}... Pro features unlocked.`);
      } catch (err) {
        setOutput(`Licence save failed: ${(err as Error).message}`);
      }
      return;
    }
    case "check-licence": {
      const isPro = await hasProLicence(storage);
      if (isPro) {
        const key = await getLicence(storage);
        const preview = key ? `${key.slice(0, 24)}...` : "(unknown)";
        setOutput(`Pro tier ACTIVE. Licence: ${preview}`);
      } else {
        setOutput(
          "Pro tier NOT active. Buy at polar.sh/architext1/grip-post-pro then paste your licence key above.",
        );
      }
      return;
    }
    case "clear-licence": {
      await clearLicence(storage);
      setOutput("Licence removed. Pro features locked.");
      return;
    }
    case "show-stats": {
      const s = await getStats(storage);
      setOutput(formatStats(s));
      return;
    }
    case "reset-stats": {
      await resetStats(storage);
      setOutput("Stats reset. Counters back to zero.");
      return;
    }
    case "receipt": {
      const data = gatherReceipt({
        text,
        cleanChecks: 0,
        date: today(),
        version: extensionVersion(),
      });
      // Honest running tally: a clean post advances the same local-only
      // `fluff.clean` counter that "Show my stats" reads. Zero network.
      if (data.clean) await bump("fluff.clean", 1, storage);
      const stats = await getStats(storage);
      const cleanChecks = stats.counts["fluff.clean"] ?? 0;
      lastReceipt = formatReceipt({ ...data, cleanChecks });
      setOutput(lastReceipt);
      return;
    }
    case "copy-receipt": {
      if (!lastReceipt) {
        setOutput("Make a receipt first, then copy it.");
        return;
      }
      try {
        // Clipboard write runs inside the click gesture (transient
        // activation) so it needs NO new manifest permission — the
        // capability lock stays unwidened. Falls back to manual select.
        await navigator.clipboard.writeText(lastReceipt);
        setOutput(`${lastReceipt}\n\n— copied to clipboard —`);
      } catch {
        setOutput(`${lastReceipt}\n\n(couldn't auto-copy — select the text above)`);
      }
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
    // Local-only counter bump. Pure storage, zero network. See lib/telemetry.ts.
    void bump(`transform.${transform}` as StatEvent, 1, storage);
    return;
  }
  if (action && VALID_ACTIONS.has(action)) {
    void handleAction(action);
    void bump(`action.${action}` as StatEvent, 1, storage);
    return;
  }
});
