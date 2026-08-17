// grip-post LinkedIn advisor — the honest cost of the styling trick.
//
// Why this exists:
//   grip-post's personality is honesty about your own post. anti-fluff tells
//   you your writing is padded; receipt tells you the draft is clean and that
//   nothing left your device. This module applies the same discipline to the
//   Unicode formatter itself — it tells you what the styling you are about to
//   paste actually costs you.
//
//   Most Unicode-formatter tools sell the trick and never mention the bill.
//   The bill is real and it has three lines: assistive technology cannot read
//   these characters as letters, LinkedIn's search index cannot match them,
//   and some fonts cannot draw them. Saying so is the product.
//
// Pure functions — no DOM, no chrome.*, no network, no clock. Every number
// rendered here is either computed from the text in this process or a named
// constant carrying its source and the date it was checked.

import { STYLED_GLYPH_LO, STYLED_GLYPH_HI } from "./receipt";

/**
 * Hard character limit for a LinkedIn post (a share/update, not an article).
 *
 * Source: LinkedIn Help, "Post and share updates"
 * (https://www.linkedin.com/help/linkedin/answer/a528176), which states:
 * "The character limit for a post is 3,000 characters." Checked 2026-08-17.
 *
 * This is LinkedIn's own documentation, so the figure is exact rather than an
 * estimate, and it is rendered without hedging.
 */
export const POST_CHAR_LIMIT = 3000;

/**
 * APPROXIMATE point at which the feed collapses a post behind "see more".
 *
 * LinkedIn does not document this figure anywhere, and it moves with device,
 * window width, app version, and where the line breaks fall. Third-party
 * measurements (checked 2026-08-17) disagree with each other: AuthoredUp,
 * Lifa.st and Linkboost all put the fold near 210 characters on desktop and
 * near 140 on mobile, while Taplio measures desktop closer to 250.
 *
 * Because the sources disagree we take the CONSERVATIVE value — the smallest
 * of them, 140 — so the warning fires early rather than late. Every surface
 * that prints this number labels it "approx", because it is.
 */
export const FOLD_CHARS_APPROX = 140;

/** A contiguous span of codepoints, named so warnings can say what is present. */
export interface CodepointRange {
  readonly lo: number;
  readonly hi: number;
  readonly label: string;
}

/**
 * The single source of truth for "this character is styled, not a letter".
 * Every styled-character decision in this module derives from this table, so
 * adding a block is a one-line change with no duplicated predicate to keep in
 * step. Each range is verified against the live runtime in
 * `tests/linkedin.test.ts` by asserting the actual glyph.
 */
export const STYLED_RANGES: readonly CodepointRange[] = [
  // Mathematical Alphanumeric Symbols — what toBold/toItalic produce. Bounds
  // imported from receipt.ts rather than restated, so the two cannot drift.
  { lo: STYLED_GLYPH_LO, hi: STYLED_GLYPH_HI, label: "mathematical alphanumeric" },
  // Combining Diacritical Marks — the underline (U+0332) and strikethrough
  // (U+0336) trick, which glues a mark onto an otherwise ordinary letter.
  { lo: 0x0300, hi: 0x036f, label: "combining marks" },
  // Enclosed Alphanumerics — circled letters, Ⓐ through ⓩ.
  { lo: 0x24b6, hi: 0x24e9, label: "circled letters" },
  // Halfwidth and Fullwidth Forms — the wide-letter look, Ａ through ｚ.
  { lo: 0xff21, hi: 0xff5a, label: "fullwidth letters" },
] as const;

/** True when the codepoint falls in any styled range. Derived, never listed. */
export function isStyledCodepoint(cp: number): boolean {
  return STYLED_RANGES.some((r) => cp >= r.lo && cp <= r.hi);
}

/** Count styled codepoints in the text. Plain ASCII always yields 0. */
export function countStyledChars(s: string): number {
  let n = 0;
  for (const ch of s) if (isStyledCodepoint(ch.codePointAt(0) ?? 0)) n++;
  return n;
}

/** Names of the styled blocks actually present, in table order. */
export function styledRangesPresent(s: string): string[] {
  const seen = new Set<string>();
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    for (const r of STYLED_RANGES) if (cp >= r.lo && cp <= r.hi) seen.add(r.label);
  }
  return STYLED_RANGES.map((r) => r.label).filter((l) => seen.has(l));
}

/** Grapheme segmenter, created once. Null when the runtime lacks Intl.Segmenter. */
const SEGMENTER: Intl.Segmenter | null =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * Count what a reader sees as one character.
 *
 * This is the whole reason `measurePost` exists rather than a caller reading
 * `.length`. A bolded post is built from astral codepoints, so `.length`
 * counts every visible letter twice and would report a 1,600-character post
 * as over LinkedIn's 3,000 limit. An underlined post is the opposite case:
 * base letter plus combining mark reads as one character but counts as two.
 * Only grapheme segmentation gets both right.
 *
 * Falls back to codepoint iteration (`[...s]`) where Intl.Segmenter is absent
 * — still correct for the astral case, only approximate for combining marks.
 */
export function countGraphemes(s: string): number {
  if (s.length === 0) return 0;
  if (SEGMENTER === null) return [...s].length;
  let n = 0;
  const it = SEGMENTER.segment(s)[Symbol.iterator]();
  while (!it.next().done) n++;
  return n;
}

/** The text up to the first newline — the hook, and where keywords live. */
export function firstLine(s: string): string {
  const nl = s.indexOf("\n");
  return nl === -1 ? s : s.slice(0, nl);
}

/**
 * Styled proportion at which the accessibility warning changes register.
 * Below `moderate` a styled phrase is a defensible trade; at or above `heavy`
 * the post is not text to a screen reader at all.
 */
export const STYLED_SEVERITY = {
  moderate: 0.2,
  heavy: 0.6,
} as const;

/** What the post costs, measured rather than assumed. */
export interface PostMetrics {
  /** Grapheme count — what a reader sees, not UTF-16 units. */
  readonly chars: number;
  /** Styled or combining codepoints; plain ASCII contributes nothing. */
  readonly styledChars: number;
  /** Line count. An empty post is 0 lines. */
  readonly lines: number;
  /** True when the post exceeds LinkedIn's documented 3,000-character limit. */
  readonly overLimit: boolean;
  /** True when the post runs past the approximate "see more" fold. */
  readonly beyondFold: boolean;
}

/** Measure a draft. Pure and deterministic for a given string. */
export function measurePost(s: string): PostMetrics {
  const chars = countGraphemes(s);
  return {
    chars,
    styledChars: countStyledChars(s),
    lines: s.length === 0 ? 0 : s.split("\n").length,
    overLimit: chars > POST_CHAR_LIMIT,
    beyondFold: chars > FOLD_CHARS_APPROX,
  };
}

/** Styled share of the post, clamped to 1 (combining marks can stack). */
function styledRatio(m: PostMetrics): number {
  if (m.chars === 0) return 0;
  return Math.min(1, m.styledChars / m.chars);
}

/** The screen-reader sentence, scaled to how much of the post is styled. */
function screenReaderLine(m: PostMetrics, ratio: number): string {
  const pct = Math.round(ratio * 100);
  if (ratio >= STYLED_SEVERITY.heavy) {
    return (
      `Screen readers: ${pct}% of this post is styled Unicode. ` +
      "To assistive technology these are symbols, not letters, so a blind " +
      "reader gets a stream of symbol names or silence — not your post. " +
      "At this proportion the post is effectively unreadable to them."
    );
  }
  if (ratio >= STYLED_SEVERITY.moderate) {
    return (
      `Screen readers: ${pct}% of this post is styled Unicode. ` +
      "Assistive technology does not treat these as letters — it announces " +
      "them one symbol at a time or skips them, so a blind reader loses a " +
      "large part of what you wrote."
    );
  }
  return (
    `Screen readers: ${m.styledChars} of ${m.chars} characters are styled ` +
    "Unicode. Assistive technology does not treat these as letters, so that " +
    "phrase is lost to a blind reader. A styled phrase is a reasonable trade; " +
    "a wholly styled post is not."
  );
}

/**
 * The honest warnings — empty string when there is nothing to warn about.
 *
 * A warning that always fires is noise, so plain ASCII returns "". Styling is
 * what carries the cost, and every line below is a consequence of it:
 *  1. assistive technology cannot read these characters as letters;
 *  2. LinkedIn's search index cannot match them, which matters most in the
 *     first line, where the keywords go;
 *  3. some fonts cannot draw them and show empty boxes instead.
 */
export function accessibilityWarning(s: string): string {
  const m = measurePost(s);
  if (m.styledChars === 0) return "";

  const lines: string[] = [screenReaderLine(m, styledRatio(m))];

  if (countStyledChars(firstLine(s)) > 0) {
    lines.push(
      "Search: your first line contains styled characters. LinkedIn's search " +
        "index matches ordinary letters, not these substitutes, so a styled " +
        "keyword in your opening cannot be found by anyone searching for it.",
    );
  }

  lines.push(
    `Rendering: some Android and older desktop fonts lack these blocks ` +
      `(${styledRangesPresent(s).join(", ")}) and draw empty boxes instead of letters.`,
  );

  return lines.join("\n");
}

/** Inner content width of the metrics block — matches formatReceipt's register. */
const WIDTH = 21;
const RULE = "  " + "─".repeat(WIDTH);

/**
 * One `label ......... value` row, dot-leader aligned to WIDTH. Mirrors the
 * private helper in receipt.ts; that one is not exported and receipt.ts is
 * not this module's to change, so the shape is matched rather than shared.
 */
function row(label: string, value: number): string {
  const v = String(value);
  const dots = Math.max(2, WIDTH - label.length - v.length - 2);
  return `  ${label} ${".".repeat(dots)} ${v}`;
}

/**
 * Render the metrics as one compact monospace block, in the same visual
 * register as formatReceipt — a fixed-width font, screenshot-ready.
 *
 * The fold figure is printed with a tilde and the word "approx" because it is
 * an approximation; the 3,000 limit is printed bare because LinkedIn
 * documents it.
 */
export function formatMetrics(m: PostMetrics): string {
  const lines: string[] = [];
  lines.push("     · post metrics ·");
  lines.push(RULE);
  lines.push(row("characters", m.chars));
  lines.push(row("styled", m.styledChars));
  lines.push(row("lines", m.lines));
  lines.push(RULE);

  lines.push(
    m.overLimit
      ? `  ⚠ over the ${POST_CHAR_LIMIT} limit`
      : `  ✓ within the ${POST_CHAR_LIMIT} limit`,
  );
  lines.push(
    m.beyondFold
      ? `  ⚠ past the ~${FOLD_CHARS_APPROX} fold (approx)`
      : `  ✓ before the ~${FOLD_CHARS_APPROX} fold (approx)`,
  );
  lines.push(RULE);
  return lines.join("\n");
}
