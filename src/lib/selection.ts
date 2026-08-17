// grip-post selection algebra — pure, DOM-free core for selection-scoped
// editing and the undo stack. No DOM, no chrome.*, no clipboard, no side
// effects. A caller wires these to a textarea; nothing here knows one exists.
//
// UNITS: every index is a UTF-16 code-unit offset, because that is exactly
// what `textarea.selectionStart` / `selectionEnd` report. We deliberately do
// NOT convert to codepoint indices — slicing must use the same units the DOM
// hands us, or an astral character (emoji, or our own bold output, which is
// Mathematical Sans-Serif and therefore two units per glyph) silently shifts
// every offset after it.

/** A half-open selection over UTF-16 code-unit offsets: [start, end). */
export interface Range {
  readonly start: number;
  readonly end: number;
}

/** The result of an edit: the whole new text, plus where the result now sits. */
export interface EditResult {
  readonly text: string;
  readonly selection: Range;
}

/**
 * Clamp a range to the text bounds and put its endpoints in order.
 *
 * Two things are normalised here:
 *
 *  1. Out-of-bounds endpoints are clamped to [0, text.length], and an
 *     inverted range is swapped. A user dragging right-to-left produces
 *     `start > end` in some browsers, so this is a real input, not a
 *     theoretical one.
 *
 *  2. DECISION — a collapsed range (start === end, i.e. a caret with nothing
 *     selected) means THE WHOLE DOCUMENT. This is deliberate and
 *     load-bearing, not an accident of the implementation. The overwhelmingly
 *     common action in this extension is "paste a post, click Bold" with no
 *     selection at all, and that user must keep getting their whole post
 *     transformed. Treating a bare caret as an empty range instead would
 *     transform nothing and break every existing caller. It lives in
 *     `normaliseRange` rather than in each consumer so there is exactly one
 *     implementation of the rule, and every function that takes a Range
 *     inherits it.
 */
export function normaliseRange(text: string, r: Range): Range {
  const limit = text.length;
  const a = Math.min(Math.max(r.start, 0), limit);
  const b = Math.min(Math.max(r.end, 0), limit);
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (start === end) return { start: 0, end: limit };
  return { start, end };
}

/**
 * Grow a range to whole-line boundaries: from the start of the line its
 * start falls on, to the end of the line its end falls on. Line transforms
 * (bullets, numbering) are nonsense applied to half a line.
 *
 * The end lands ON the trailing newline, never past it, so a range that ends
 * exactly at a line break does not swallow the line that follows. A range
 * that extends past a newline onto the next line does include that next
 * line — the range genuinely touches it.
 */
export function expandToLines(text: string, r: Range): Range {
  const { start, end } = normaliseRange(text, r);
  // Guard start === 0 explicitly: `lastIndexOf(needle, -1)` still probes
  // index 0, so on a text that opens with a newline the naive form would
  // return 0 and push the line start to 1.
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  return { start: lineStart, end: lineEnd };
}

/**
 * Apply `fn` to just the selected slice and splice the result back in.
 *
 * Returns the full new text AND the selection covering the transformed
 * result. The transform almost always changes length — bold maps to astral
 * codepoints (two UTF-16 units per glyph), bracketing adds characters — so a
 * caller that kept the original end would leave the user's selection sitting
 * over the wrong span, and their next click would transform the wrong text.
 * The returned selection always re-slices to exactly `fn(slice)`.
 */
export function applyToRange(
  text: string,
  r: Range,
  fn: (slice: string) => string,
): EditResult {
  const { start, end } = normaliseRange(text, r);
  const replaced = fn(text.slice(start, end));
  return {
    text: text.slice(0, start) + replaced + text.slice(end),
    selection: { start, end: start + replaced.length },
  };
}

/**
 * Replace the selected slice with fixed text.
 *
 * Inherits the collapsed-means-whole-document rule from `normaliseRange`, so
 * a collapsed range replaces the entire text rather than inserting at the
 * caret. That is the consistent reading of the rule across this module: one
 * meaning for a collapsed range everywhere, rather than a per-function
 * exception a caller has to memorise.
 */
export function replaceRange(
  text: string,
  r: Range,
  replacement: string,
): EditResult {
  return applyToRange(text, r, () => replacement);
}

/** One snapshot in the undo stack: the text, and where the user was in it. */
export interface HistoryState {
  readonly text: string;
  readonly selection: Range;
}

/** A past/present/future zipper. `present` is always the live state. */
export interface History {
  readonly past: readonly HistoryState[];
  readonly present: HistoryState;
  readonly future: readonly HistoryState[];
}

/** Default cap on retained undo steps. */
export const HISTORY_LIMIT = 50;

/** Start a history at `s`, with nothing to undo or redo. */
export function initHistory(s: HistoryState): History {
  return { past: [], present: s, future: [] };
}

/**
 * Record `next` as the new present.
 *
 * Clears the future — standard editor semantics: editing after an undo
 * abandons the redo branch. Caps `past` at `limit` by dropping the OLDEST
 * entry, so the stack is bounded and the most recent steps are the ones kept.
 */
export function pushHistory(
  h: History,
  next: HistoryState,
  limit: number = HISTORY_LIMIT,
): History {
  const appended = [...h.past, h.present];
  // `slice(-0)` returns the whole array, so a non-positive limit has to be
  // handled explicitly or "keep nothing" would silently mean "keep all".
  const past = limit <= 0 ? [] : appended.slice(-limit);
  return { past, present: next, future: [] };
}

/** Step back one state. Returns `h` unchanged when there is nothing to undo. */
export function undo(h: History): History {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

/** Step forward one state. Returns `h` unchanged when there is nothing to redo. */
export function redo(h: History): History {
  if (h.future.length === 0) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
  };
}

/** True when `undo` would change anything. */
export function canUndo(h: History): boolean {
  return h.past.length > 0;
}

/** True when `redo` would change anything. */
export function canRedo(h: History): boolean {
  return h.future.length > 0;
}
