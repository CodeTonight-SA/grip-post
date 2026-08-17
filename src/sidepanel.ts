// grip-post side panel — the editor shell around the pure toolkit.
//
// THE MODEL: the textarea IS the working document.
//
// A transform applies to whatever the user has SELECTED and splices the result
// back into the textarea; the output box mirrors the textarea as a live
// preview. Two consequences follow, and both are the point:
//
//   1. Only the selected words change. Everything else is left byte-identical,
//      which is what a formatting toolbar has to do to be usable at all.
//   2. Transforms COMPOSE. Bold one phrase, italicise another, bullet a list —
//      each edit lands on the document the previous one produced.
//
// A collapsed selection (a bare caret) means the whole document. That rule
// lives in selection.normaliseRange, not here, so every path inherits one
// definition of it. It keeps "paste a post, click Bold" working for the user
// who never selects anything.
//
// Three attribute namespaces:
//   data-transform="<TransformKey>"  → edit the document, or render a report
//   data-action="<name>"             → a side effect against storage / window
//
// Adding a transform is one row in the TRANSFORMS table in lib/unicode-toolkit
// plus a button; this file derives its key set from that table so the two
// cannot drift apart.

import {
  dispatch,
  transformClass,
  TRANSFORMS,
  type TransformKey,
} from "./lib/unicode-toolkit";
import {
  applyToRange,
  expandToLines,
  initHistory,
  pushHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo,
  canRedo,
  type History,
  type HistoryState,
  type Range,
} from "./lib/selection";
import { measurePost, accessibilityWarning } from "./lib/linkedin";
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
const metrics = document.getElementById("metrics") as HTMLElement | null;
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

// WHY AN EXPLICIT UNDO STACK, rather than leaning on the browser's:
// assigning to textarea.value REPLACES the element's content wholesale and
// discards its native undo history. After one programmatic edit, Cmd+Z gives
// the user nothing back. Since every transform here is a programmatic edit,
// an explicit stack is the only way the user can recover their draft — it is
// a requirement of the design, not a nicety layered on top of it.
let history: History = initHistory({
  text: "",
  selection: { start: 0, end: 0 },
});

/**
 * How long a typist must pause before their text becomes an undo step.
 * Granularity only: a word or a phrase per step rather than a character.
 * Correctness does not depend on it — `commit` captures unsnapshotted text
 * before every edit.
 */
const TYPING_SNAPSHOT_MS = 400;

let typingTimer: ReturnType<typeof setTimeout> | undefined;

/** Drop a pending typing snapshot. */
function cancelTypingSnapshot(): void {
  if (typingTimer !== undefined) {
    clearTimeout(typingTimer);
    typingTimer = undefined;
  }
}

/** Derived from the transform table, so a key cannot exist in one and not the other. */
const VALID_KEYS: ReadonlySet<string> = new Set(TRANSFORMS.map((t) => t.key));

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
  "undo",
  "redo",
  "copy-output",
  "clear-input",
]);

function setOutput(text: string): void {
  if (output) output.textContent = text;
}

/** The document as it stands: its text and where the user is in it. */
function readDoc(): HistoryState {
  const text = input?.value ?? "";
  return {
    text,
    selection: {
      start: input?.selectionStart ?? text.length,
      end: input?.selectionEnd ?? text.length,
    },
  };
}

/**
 * Live post measurements, the honest warning, and any notice about what the
 * last click just did.
 *
 * The notice goes here rather than in the output box because the output box
 * mirrors the document — anything written there is overwritten by the next
 * render. This is the advisory surface, so advisories belong here.
 */
function renderMetrics(text: string, notice = ""): void {
  if (!metrics) return;
  const m = measurePost(text);
  const parts = [
    `${m.chars} chars`,
    `${m.lines} line${m.lines === 1 ? "" : "s"}`,
  ];
  if (m.styledChars > 0) parts.push(`${m.styledChars} styled`);
  if (m.beyondFold) parts.push("past the fold");
  if (m.overLimit) parts.push("OVER THE LIMIT");
  const warning = accessibilityWarning(text);
  const lines = [parts.join(" · ")];
  if (notice) lines.push(notice);
  if (warning) lines.push(warning);
  metrics.textContent = lines.join("\n");
}

/** Reflect a document state into the DOM: textarea, preview, metrics, buttons. */
function render(state: HistoryState, focus: boolean, notice = ""): void {
  if (input) {
    input.value = state.text;
    if (focus) {
      input.focus();
      input.setSelectionRange(state.selection.start, state.selection.end);
    }
  }
  setOutput(state.text);
  renderMetrics(state.text, notice);
  syncUndoButtons();
}

/** Undo and redo are disabled when they would do nothing — honest affordance. */
function syncUndoButtons(): void {
  const set = (action: string, enabled: boolean): void => {
    const btn = document.querySelector<HTMLButtonElement>(
      `button[data-action="${action}"]`,
    );
    if (btn) btn.disabled = !enabled;
  };
  set("undo", canUndo(history));
  set("redo", canRedo(history));
}

/** Record the current document, then apply and show the next one. */
function commit(next: HistoryState, notice = ""): void {
  // Typing is snapshotted on a pause (see the input listener). A user who
  // types and then immediately clicks a button acts inside that pause, so
  // what they just typed was never recorded — and undo would hand them back
  // a stale draft instead of the one they were looking at. Capture the live
  // document here, before the edit lands, whenever it has drifted from the
  // last snapshot. That makes history correct regardless of the debounce,
  // which is then only about undo GRANULARITY, never about correctness.
  const current = readDoc();
  if (current.text !== history.present.text) {
    history = pushHistory(history, current);
  }
  // A pending snapshot would now duplicate this state; drop it.
  cancelTypingSnapshot();
  history = pushHistory(history, next);
  render(next, true, notice);
}

/**
 * Run one transform against the document.
 *
 * The transform's CLASS decides what range it sees, and the class comes from
 * the shared table rather than a list maintained here — so a `report` key can
 * never be spliced into the user's post by an oversight in this file.
 */
function runTransform(key: TransformKey): void {
  const doc = readDoc();
  const cls = transformClass(key);

  // A report reads the whole draft and answers in the output panel. It must
  // not touch the document, which is the entire reason the class exists.
  if (cls === "report") {
    setOutput(dispatch(key, doc.text));
    return;
  }

  // `line` transforms (bullets, numbering, quoting) are nonsense applied to
  // half a line, so grow the range to whole lines first. `whole` transforms
  // are selection-blind by definition. Everything else — map, wrap, insert —
  // is the same splice: replace the selected slice with its transform.
  const range: Range =
    cls === "whole"
      ? { start: 0, end: doc.text.length }
      : cls === "line"
        ? expandToLines(doc.text, doc.selection)
        : doc.selection;

  // A bare caret means the whole document (see selection.normaliseRange).
  // That is right for the common "paste a draft, click Bold" case, but it is
  // a surprise for someone who put their caret down to type and hit a button
  // by mistake — they get their whole post reformatted with no warning. The
  // rule stays, because changing it would break the common case; what changes
  // is that the tool now SAYS what it did and how to take it back. An
  // announced action is not a surprise.
  const collapsed = doc.selection.start === doc.selection.end;
  const notice =
    collapsed && cls !== "whole"
      ? "Nothing was selected, so the whole post was formatted. Undo with Cmd/Ctrl+Z."
      : "";

  const edit = applyToRange(doc.text, range, (slice) => dispatch(key, slice));

  // A transform that changed nothing must not become an undo step. Styles are
  // idempotent by design — bolding already-bold text passes it through — so
  // without this the user presses Undo, watches nothing happen, and reasonably
  // concludes undo is broken. Show the notice, skip the history entry.
  if (edit.text === doc.text) {
    renderMetrics(doc.text, notice);
    return;
  }

  commit({ text: edit.text, selection: edit.selection }, notice);
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

/** Clipboard write inside a click gesture — needs no extra manifest permission. */
async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setOutput(`${text}\n\n— ${label} copied to clipboard —`);
  } catch {
    setOutput(`${text}\n\n(couldn't auto-copy — select the text above)`);
  }
}

async function handleAction(action: string): Promise<void> {
  const text = input?.value ?? "";
  switch (action) {
    case "undo": {
      if (!canUndo(history)) {
        setOutput("Nothing to undo.");
        return;
      }
      history = undoHistory(history);
      render(history.present, true);
      return;
    }
    case "redo": {
      if (!canRedo(history)) {
        setOutput("Nothing to redo.");
        return;
      }
      history = redoHistory(history);
      render(history.present, true);
      return;
    }
    case "clear-input": {
      // Pushed to history first, so clearing is recoverable like any edit.
      commit({ text: "", selection: { start: 0, end: 0 } });
      return;
    }
    case "copy-output": {
      const value = output?.textContent ?? "";
      if (!value) {
        setOutput("Nothing to copy yet.");
        return;
      }
      await copyToClipboard(value, "post");
      return;
    }
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
      await copyToClipboard(lastReceipt, "receipt");
      return;
    }
  }
}

// KEEPING THE SELECTION ALIVE ACROSS THE CLICK.
//
// Event order on a button press is mousedown → (focus moves) → mouseup →
// click. By the time our click handler runs, focus has already left the
// textarea. Chrome does preserve selectionStart/End on a blurred textarea, so
// reading them still works — but the user watches their highlight vanish the
// instant they reach for a button, which reads as "the tool lost my
// selection" even when it did not. Cancelling mousedown's default keeps focus
// (and the visible highlight) in the textarea throughout. It is the standard
// toolbar technique, and here it buys correctness of appearance rather than
// of behaviour.
document.addEventListener("mousedown", (event) => {
  const target = (event.target as HTMLElement | null)?.closest("button");
  if (!target) return;
  if (target.dataset.transform || target.dataset.action) event.preventDefault();
});

document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement | null)?.closest("button");
  if (!target) return;
  const transform = target.dataset.transform;
  const action = target.dataset.action;
  if (transform && VALID_KEYS.has(transform)) {
    runTransform(transform as TransformKey);
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

// Cmd/Ctrl+Z undoes, Cmd+Shift+Z or Ctrl+Y redoes — the shortcuts a user
// already has in their fingers. Bound on the document so they work whether or
// not the caret is in the textarea.
document.addEventListener("keydown", (event) => {
  if (!event.metaKey && !event.ctrlKey) return;
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    void handleAction(event.shiftKey ? "redo" : "undo");
  } else if (key === "y") {
    event.preventDefault();
    void handleAction("redo");
  }
});

// Typing is the other way the document changes. Debounced so a fast typist is
// not re-measuring on every keystroke; the snapshot is taken on a pause, which
// also gives undo sensible granularity — a word or a phrase, not a character.
input?.addEventListener("input", () => {
  const text = input.value;
  setOutput(text);
  renderMetrics(text);
  cancelTypingSnapshot();
  typingTimer = setTimeout(() => {
    const now = readDoc();
    // Guard against snapshotting a state we already hold — a pause after a
    // transform would otherwise insert a no-op step the user has to undo
    // twice to get past.
    if (now.text !== history.present.text) {
      history = pushHistory(history, now);
      syncUndoButtons();
    }
  }, TYPING_SNAPSHOT_MS);
});

// Seed from whatever the textarea already holds, without stealing focus.
history = initHistory(readDoc());
render(history.present, false);
