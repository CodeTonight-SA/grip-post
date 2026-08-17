// grip-post unicode-toolkit — THE single dispatch surface.
//
// The side panel and the context-menu content script both call `dispatch`,
// so a transform can never behave one way from a button and another way from
// the right-click menu. Pure throughout: no DOM, no chrome.*, no clipboard,
// no storage, no clock. The caller decides what to do with the returned
// string; this module never touches a document.
//
// THE CENTRAL IDEA — a transform CLASS.
//
// Not every key behaves the same way, and conflating them is how a "check
// your post for fluff" report ends up spliced into the middle of somebody's
// draft. So every key declares its class in ONE table, and the editor reads
// that class to decide what to do with the result:
//
//   map     per-character over the SELECTION      bold, italic, plain, ...
//   wrap    wrap the SELECTION                    brackets, diamond
//   line    expand to whole lines, then map       bullets, numbering, quote
//   insert  replace the SELECTION with new text   rules, bars, sparklines
//   whole   transform the WHOLE input             arrow, handles
//   report  READ the whole input and render to
//           the output panel — NEVER the document check, metrics, ...
//
// `isSpliceable` derives from that class, so the report keys are excluded
// from document mutation by construction rather than by a caller remembering
// to special-case them.
//
// The table is the single source of truth for the whole UI: `TransformKey` is
// derived FROM it, so a key cannot exist in the type and be missing from the
// table (or the reverse), and the side panel's key set and its buttons are
// both generated from it rather than hand-listed.

import {
  applyStyle,
  toPlain,
  STYLE_LABELS,
  type StyleKey,
} from "./styles";
import {
  bulletList,
  numberList,
  quoteBlock,
  indentBlock,
  stripLinePrefixes,
  BULLET_LABELS,
  NUMBER_LABELS,
  type BulletKey,
  type NumberKey,
} from "./blocks";
import {
  divider,
  progressBar,
  sparkline,
  starRating,
  calloutBox,
  DIVIDER_SAMPLES,
  type DividerKey,
} from "./art";
import { reportFluff, formatReport } from "./anti-fluff";
import { stripTells, formatStripReport } from "./strip-tells";
import { reportGrounding, formatGroundingReport } from "./r0-grounding";
import { measurePost, formatMetrics } from "./linkedin";

// ---------------------------------------------------------------------------
// Legacy primitives — the v0.1 surface, still exported by name
// ---------------------------------------------------------------------------

/**
 * Math Sans-Serif Bold — A-Z, a-z, 0-9; non-ASCII passes through.
 *
 * Delegates to the style table rather than carrying its own copy of the
 * codepoint runs. The two implementations were byte-identical (same three
 * runs, same per-character mapping), so the duplicate table here was deleted
 * and `tests/unicode-toolkit.test.ts` pins the result against the original
 * arithmetic across the whole ASCII range so the deletion stays honest.
 */
export function toBold(s: string): string {
  return applyStyle("bold", s);
}

/** Math Sans-Serif Italic — A-Z, a-z; digits and non-ASCII pass through. */
export function toItalic(s: string): string {
  return applyStyle("italic", s);
}

/** Wrap string in corner brackets: ⌜ S ⌟ */
export function wrapCornerBrackets(s: string): string {
  return `⌜ ${s} ⌟`;
}

/**
 * Repeat ━ (U+2501) `width` times. Clamped to [0, 200].
 * Non-positive width returns "".
 *
 * Kept as its own implementation rather than delegating to `divider("heavy")`:
 * the two clamp differently at the edges (this one saturates an infinite
 * width to 200, the art module treats a non-finite width as 0) and they carry
 * different defaults, so folding them together would change behaviour here.
 */
export function heavyHorizontal(width: number): string {
  const w = Math.min(Math.max(Math.floor(width), 0), 200);
  return "━".repeat(w);
}

/** Bullet-arrow prefix: ▸  ─→  label */
export function bulletArrow(label: string): string {
  return `▸  ─→  ${label}`;
}

/**
 * Join handles with middle-dot separator (U+00B7).
 * Empty array → "". Single item → that item unchanged.
 */
export function joinHandles(handles: string[]): string {
  return handles.join(" · ");
}

/** Append diamond terminator: s + " ◆" */
export function diamondTerminate(s: string): string {
  return `${s} ◆`;
}

// ---------------------------------------------------------------------------
// The transform table
// ---------------------------------------------------------------------------

/**
 * What the editor should DO with a key's result.
 *
 * `report` is the load-bearing one: those keys read the whole draft and
 * render an answer for the reader, and their output must never be written
 * back into the post. See `isSpliceable`.
 */
export type TransformClass =
  | "map"
  | "wrap"
  | "line"
  | "insert"
  | "whole"
  | "report";

/** The shape every row of the table satisfies. `key` stays literal. */
interface TransformRow {
  readonly key: string;
  readonly cls: TransformClass;
  readonly label: string;
  readonly group: string;
  readonly hint?: string;
}

/**
 * Every transform, in toolbar order. This is the ONLY place a key is
 * declared: the `TransformKey` union, the handler table, the group list and
 * the side panel's buttons all derive from these rows.
 *
 * Labels for the style, bullet and numbering families repeat the label their
 * owning module publishes. That repetition is checked rather than trusted —
 * `tests/unicode-toolkit.test.ts` asserts each one still equals
 * `STYLE_LABELS` / `BULLET_LABELS` / `NUMBER_LABELS`, so a rename in one
 * place cannot leave a stale button behind in the other.
 */
const TABLE = [
  // Style — per-character over the selection.
  { key: "bold", cls: "map", label: "Bold", group: "Style" },
  { key: "italic", cls: "map", label: "Italic", group: "Style" },
  { key: "bold-italic", cls: "map", label: "Bold italic", group: "Style" },
  { key: "mono", cls: "map", label: "Monospace", group: "Style" },
  { key: "script", cls: "map", label: "Script", group: "Style" },
  { key: "fraktur", cls: "map", label: "Fraktur", group: "Style" },
  { key: "double-struck", cls: "map", label: "Double-struck", group: "Style" },
  { key: "wide", cls: "map", label: "Wide", group: "Style" },
  { key: "underline", cls: "map", label: "Underline", group: "Style" },
  { key: "strike", cls: "map", label: "Strikethrough", group: "Style" },
  { key: "super", cls: "map", label: "Superscript", group: "Style" },
  { key: "sub", cls: "map", label: "Subscript", group: "Style" },
  {
    key: "plain",
    cls: "map",
    label: "Plain",
    group: "Style",
    hint: "Undo every style and return the text to ordinary letters.",
  },

  // Wrap — decorate the selection, or the whole draft.
  { key: "brackets", cls: "wrap", label: "Brackets", group: "Wrap" },
  { key: "diamond", cls: "wrap", label: "Diamond", group: "Wrap" },
  {
    key: "arrow",
    cls: "whole",
    label: "Arrow",
    group: "Wrap",
    hint: "Prefix the text with a bullet arrow.",
  },
  {
    key: "handles",
    cls: "whole",
    label: "Handles",
    group: "Wrap",
    hint: "Comma-separated names, joined with a middle dot.",
  },

  // Lists — whole lines, never half a line.
  { key: "bullet-dot", cls: "line", label: "Dot", group: "Lists" },
  { key: "bullet-arrow", cls: "line", label: "Arrow", group: "Lists" },
  { key: "bullet-triangle", cls: "line", label: "Triangle", group: "Lists" },
  { key: "bullet-square", cls: "line", label: "Square", group: "Lists" },
  { key: "bullet-check", cls: "line", label: "Check", group: "Lists" },
  { key: "bullet-star", cls: "line", label: "Star", group: "Lists" },
  { key: "bullet-dash", cls: "line", label: "Dash", group: "Lists" },
  { key: "bullet-sparkle", cls: "line", label: "Sparkle", group: "Lists" },
  { key: "number-plain", cls: "line", label: "Plain", group: "Lists" },
  { key: "number-circled", cls: "line", label: "Circled", group: "Lists" },
  { key: "number-filled", cls: "line", label: "Filled", group: "Lists" },
  { key: "number-paren", cls: "line", label: "Parenthesised", group: "Lists" },

  // Blocks — whole lines again, but framing rather than marking.
  { key: "quote", cls: "line", label: "Quote", group: "Blocks" },
  { key: "indent", cls: "line", label: "Indent", group: "Blocks" },
  {
    key: "strip-prefix",
    cls: "line",
    label: "Strip prefix",
    group: "Blocks",
    hint: "Remove one bullet, numeral, quote rule or indent per line.",
  },

  // Art — generated text that replaces the selection.
  {
    key: "hr",
    cls: "insert",
    label: "Rule",
    group: "Art",
    hint: "Heavy rule. Type a width first; blank means 30.",
  },
  { key: "divider-heavy", cls: "insert", label: "Heavy", group: "Art" },
  { key: "divider-double", cls: "insert", label: "Double", group: "Art" },
  { key: "divider-dotted", cls: "insert", label: "Dotted", group: "Art" },
  { key: "divider-dashed", cls: "insert", label: "Dashed", group: "Art" },
  { key: "divider-wave", cls: "insert", label: "Wave", group: "Art" },
  { key: "divider-stars", cls: "insert", label: "Stars", group: "Art" },
  { key: "divider-fade", cls: "insert", label: "Fade", group: "Art" },
  {
    key: "progress",
    cls: "insert",
    label: "Progress",
    group: "Art",
    hint: "Type a percentage first; blank means 0.",
  },
  {
    key: "sparkline",
    cls: "insert",
    label: "Sparkline",
    group: "Art",
    hint: "Type numbers separated by commas or spaces.",
  },
  {
    key: "stars",
    cls: "insert",
    label: "Rating",
    group: "Art",
    hint: "Type a score out of five; blank means 0.",
  },
  {
    key: "callout",
    cls: "insert",
    label: "Callout",
    group: "Art",
    hint: "Draw a monospace box around the text.",
  },

  // Checks — these READ your post and answer you. They never edit it.
  {
    key: "check",
    cls: "report",
    label: "Check fluff",
    group: "Checks",
    hint: "Reads your post and reports back. Never edits it.",
  },
  {
    key: "strip-tells",
    cls: "report",
    label: "Strip AI tells",
    group: "Checks",
    hint: "Shows the cleaned text and what it removed. Never edits your post.",
  },
  {
    key: "ground-check",
    cls: "report",
    label: "Ground check",
    group: "Checks",
    hint: "Flags claims with nothing behind them. Never edits your post.",
  },
  {
    key: "metrics",
    cls: "report",
    label: "Metrics",
    group: "Checks",
    hint: "Characters, styled characters, the limit and the fold.",
  },
] as const satisfies readonly TransformRow[];

/**
 * Every transform key, derived from the table so the two cannot drift.
 * Ten of these — bold, italic, brackets, hr, arrow, handles, diamond, check,
 * strip-tells, ground-check — are the v0.1 surface and their output is frozen
 * by hard-coded assertions in the tests.
 */
export type TransformKey = (typeof TABLE)[number]["key"];

/** One row of the transform table, as published to the UI. */
export interface TransformSpec {
  readonly key: TransformKey;
  readonly cls: TransformClass;
  /** Button text. */
  readonly label: string;
  /** Toolbar section, e.g. "Style", "Lists", "Art", "Checks". */
  readonly group: string;
  /** Optional tooltip — present where the input format is not obvious. */
  readonly hint?: string;
}

/** The transform table, in toolbar order. */
export const TRANSFORMS: readonly TransformSpec[] = TABLE;

/** Toolbar sections in first-appearance order, derived from the table. */
export const TRANSFORM_GROUPS: readonly string[] = [
  ...new Set(TRANSFORMS.map((t) => t.group)),
];

const CLASS_BY_KEY: ReadonlyMap<TransformKey, TransformClass> = new Map(
  TRANSFORMS.map((t) => [t.key, t.cls]),
);

/** What the editor should do with this key's result. */
export function transformClass(key: TransformKey): TransformClass {
  // Every key comes from the same table the map is built from, so the lookup
  // cannot miss; the fallback exists only to keep the return type honest for
  // a caller that reaches this with an unchecked string.
  return CLASS_BY_KEY.get(key) ?? "report";
}

/**
 * True when this key's output may be written back into the document.
 *
 * The one thing this guarantees: a `report` key can never be spliced into a
 * draft, because the answer is derived from the class in the table rather
 * than from a list somebody has to remember to update. Adding a new check is
 * one row with `cls: "report"`, and it is excluded from mutation the moment
 * it exists.
 */
export function isSpliceable(key: TransformKey): boolean {
  return transformClass(key) !== "report";
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

type Handler = (raw: string) => string;

/**
 * Build `{ prefix + key: handler }` for a family of keys owned by another
 * module. Passing "" as the prefix gives the family's own keys unchanged.
 * The key list comes from that module's published table, so a family gains a
 * handler the moment it gains a member.
 */
function family<P extends string, K extends string>(
  prefix: P,
  keys: readonly K[],
  make: (k: K) => Handler,
): Record<`${P}${K}`, Handler> {
  return Object.fromEntries(
    keys.map((k) => [`${prefix}${k}`, make(k)]),
  ) as Record<`${P}${K}`, Handler>;
}

const STYLE_KEYS = Object.keys(STYLE_LABELS) as StyleKey[];
const BULLET_KEYS = Object.keys(BULLET_LABELS) as BulletKey[];
const NUMBER_KEYS = Object.keys(NUMBER_LABELS) as NumberKey[];
const DIVIDER_KEYS = Object.keys(DIVIDER_SAMPLES) as DividerKey[];

/** Parse `raw` as an integer; blank or non-numeric input yields `fallback`. */
function intOr(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse `raw` as a decimal; blank or non-numeric input yields `fallback`. */
function floatOr(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Split on commas and/or whitespace, keeping only the finite numbers. */
function parseSeries(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((part) => Number.parseFloat(part))
    .filter((n) => Number.isFinite(n));
}

/**
 * A divider handler that takes its width from the input when one is given,
 * and otherwise leaves the art module to apply its own default rather than
 * restating that number here.
 */
function dividerHandler(kind: DividerKey): Handler {
  return (raw) => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? divider(kind, n) : divider(kind);
  };
}

/**
 * Every key's handler. Typing this as `Record<TransformKey, Handler>` is what
 * makes the table exhaustive: a key added to `TABLE` without a handler is a
 * compile error, not a runtime `undefined is not a function`.
 */
const HANDLERS: Readonly<Record<TransformKey, Handler>> = {
  ...family("", STYLE_KEYS, (k) => (raw) => applyStyle(k, raw)),
  plain: toPlain,

  brackets: wrapCornerBrackets,
  diamond: diamondTerminate,
  arrow: bulletArrow,
  handles: (raw) =>
    joinHandles(raw.split(",").map((s) => s.trim()).filter(Boolean)),

  ...family("bullet-", BULLET_KEYS, (k) => (raw) => bulletList(raw, k)),
  ...family("number-", NUMBER_KEYS, (k) => (raw) => numberList(raw, k)),
  quote: quoteBlock,
  indent: indentBlock,
  "strip-prefix": stripLinePrefixes,

  hr: (raw) => heavyHorizontal(intOr(raw, 30)),
  ...family("divider-", DIVIDER_KEYS, dividerHandler),
  progress: (raw) => progressBar(floatOr(raw, 0)),
  sparkline: (raw) => sparkline(parseSeries(raw)),
  stars: (raw) => starRating(floatOr(raw, 0)),
  callout: calloutBox,

  check: (raw) => formatReport(reportFluff(raw)),
  "strip-tells": (raw) => formatStripReport(stripTells(raw)),
  "ground-check": (raw) => formatGroundingReport(reportGrounding(raw)),
  metrics: (raw) => formatMetrics(measurePost(raw)),
};

/**
 * Apply a transform by key. Pure — no DOM, no clipboard, no side effects.
 *
 * `raw` is the text the transform acts on. Most keys take it verbatim; the
 * ones that read a value out of it say so in their `hint`:
 *  - `hr`, `divider-*`: an integer width (blank falls back to the default);
 *  - `progress`, `stars`: a number (blank falls back to 0);
 *  - `sparkline`: numbers separated by commas or whitespace;
 *  - `handles`: names separated by commas, trimmed, blanks dropped.
 *
 * A `report` key returns text for the reader, never for the document — see
 * `isSpliceable`.
 */
export function dispatch(key: TransformKey, raw: string): string {
  return HANDLERS[key](raw);
}
