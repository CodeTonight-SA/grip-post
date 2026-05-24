// grip-post unicode-toolkit — pure transform functions, no side effects, no DOM access.
// Each function maps ASCII A-Z / a-z / 0-9 via codepoint arithmetic; non-ASCII passes through.

/** Shift a single codepoint into a Unicode block; non-target chars pass through. */
function shiftChar(ch: string, base: number, srcBase: number, count: number): string {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= srcBase && cp < srcBase + count) {
    return String.fromCodePoint(cp - srcBase + base);
  }
  return ch;
}

/** Apply a per-block shift to every character in the string. */
function applyBlocks(
  s: string,
  blocks: ReadonlyArray<{ base: number; srcBase: number; count: number }>,
): string {
  return [...s]
    .map((ch) => {
      for (const b of blocks) {
        const shifted = shiftChar(ch, b.base, b.srcBase, b.count);
        if (shifted !== ch) return shifted;
      }
      return ch;
    })
    .join("");
}

const BOLD_BLOCKS = [
  { base: 0x1d5d4, srcBase: 0x41, count: 26 }, // A-Z → 𝗔-𝗭
  { base: 0x1d5ee, srcBase: 0x61, count: 26 }, // a-z → 𝗮-𝘇
  { base: 0x1d7ec, srcBase: 0x30, count: 10 }, // 0-9 → 𝟬-𝟵
] as const;

const ITALIC_BLOCKS = [
  { base: 0x1d608, srcBase: 0x41, count: 26 }, // A-Z → 𝘈-𝘡
  { base: 0x1d622, srcBase: 0x61, count: 26 }, // a-z → 𝘢-𝘻
] as const;

/** Math Sans-Serif Bold — A-Z, a-z, 0-9; non-ASCII passes through. */
export function toBold(s: string): string {
  return applyBlocks(s, BOLD_BLOCKS);
}

/** Math Sans-Serif Italic — A-Z, a-z; digits and non-ASCII pass through. */
export function toItalic(s: string): string {
  return applyBlocks(s, ITALIC_BLOCKS);
}

/** Wrap string in corner brackets: ⌜ S ⌟ */
export function wrapCornerBrackets(s: string): string {
  return `⌜ ${s} ⌟`;
}

/**
 * Repeat ━ (U+2501) `width` times. Clamped to [0, 200].
 * Non-positive width returns "".
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

import { reportFluff, formatReport } from "./anti-fluff";
import { stripTells, formatStripReport } from "./strip-tells";
import { reportGrounding, formatGroundingReport } from "./r0-grounding";

/**
 * Stable key set for v0.1 / v0.2 features. Ten transforms — Unicode
 * (W3), anti-fluff `check` (W4), and the W6 trio: `strip-tells` (Free,
 * active counterpart to `check`), `ground-check` (Pro regex floor for
 * R0 grounding). All return string so the side panel and content
 * script share a single dispatch surface.
 */
export type TransformKey =
  | "bold"
  | "italic"
  | "brackets"
  | "hr"
  | "arrow"
  | "handles"
  | "diamond"
  | "check"
  | "strip-tells"
  | "ground-check";

/**
 * Apply a transform by key. Single dispatch table so the side panel and the
 * content script (context-menu invocations) cannot drift. Pure — no DOM,
 * no clipboard, no side effects. Caller decides what to do with the result.
 *
 * Input parsing per key:
 *  - `hr`: parses `raw` as int; defaults to 30 if blank/non-numeric.
 *  - `handles`: splits on `,`, trims each, drops empties.
 *  - all others: passes `raw` straight through.
 */
export function dispatch(key: TransformKey, raw: string): string {
  switch (key) {
    case "bold":
      return toBold(raw);
    case "italic":
      return toItalic(raw);
    case "brackets":
      return wrapCornerBrackets(raw);
    case "hr": {
      const n = Number.parseInt(raw, 10);
      return heavyHorizontal(Number.isFinite(n) ? n : 30);
    }
    case "arrow":
      return bulletArrow(raw);
    case "handles":
      return joinHandles(raw.split(",").map((s) => s.trim()).filter(Boolean));
    case "diamond":
      return diamondTerminate(raw);
    case "check":
      return formatReport(reportFluff(raw));
    case "strip-tells":
      return formatStripReport(stripTells(raw));
    case "ground-check":
      return formatGroundingReport(reportGrounding(raw));
  }
}
