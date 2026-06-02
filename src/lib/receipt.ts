// grip-post receipt — "The Clean Receipt". A screenshot-ready, monospace
// integrity receipt for a finished LinkedIn post. Pure, deterministic,
// local-only.
//
// Why this exists (the honest moat, made shareable):
//   grip-post's pitch is "refuses to write fluff". The Clean Receipt turns
//   that promise into a tangible artefact — a little till-receipt the
//   operator can screenshot and post: zero clichés, zero AI tells, zero
//   unsourced claims, N characters, all checked on-device. It is the
//   product's ethos rendered as something you want to share, which is the
//   growth loop: a shared receipt is an honest, non-fluffy advert for the
//   tool that made it.
//
// What it is NOT:
//   - Not a network call. Every value is computed from the draft text in
//     this process; nothing leaves the device (the receipt SAYS so, and
//     the capability lock + telemetry module make it true).
//   - Not a new banlist or judgement. It AGGREGATES the existing pure
//     reporters (anti-fluff, strip-tells, r0-grounding) — single source of
//     truth, DRY. Change a rule in one place and the receipt follows.
//
// The honesty line (novel): styled Unicode (𝗯𝗼𝗹𝗱 / 𝘪𝘵𝘢𝘭𝘪𝘤) survives
// LinkedIn's strip BUT is read letter-by-letter by screen readers. Most
// Unicode-formatter tools never mention this; grip-post does. The receipt
// counts styled glyphs and, when any are present, prints the a11y caveat —
// refusing to hide the cost of its own trick is exactly on-brand.
//
// Pure functions — no DOM, no network, no LLM, no clock. Date + version +
// running tally are passed IN so the formatter is fully deterministic and
// Goodhart-proof under test (tests/receipt.test.ts).

import { reportFluff } from "./anti-fluff";
import { stripTells } from "./strip-tells";
import { reportGrounding } from "./r0-grounding";

/**
 * Mathematical Alphanumeric Symbols block (U+1D400–U+1D7FF) — the Unicode
 * range grip-post's bold/italic transforms map ASCII letters/digits into.
 * These glyphs (a) survive LinkedIn's formatting strip, which is the whole
 * point, and (b) are announced character-by-character ("mathematical bold
 * h, i") by screen readers, which is the honest cost. Counting THIS range
 * (not decorative wrappers like ⌜ ⌟ or ◆, which read acceptably) is what
 * makes the a11y caveat precise rather than alarmist.
 */
export const STYLED_GLYPH_LO = 0x1d400;
export const STYLED_GLYPH_HI = 0x1d7ff;

/** Count styled (Mathematical Alphanumeric) codepoints in the text. */
export function countStyledGlyphs(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= STYLED_GLYPH_LO && cp <= STYLED_GLYPH_HI) n++;
  }
  return n;
}

/** Caller-supplied context for a receipt. Everything is a primitive so the
 * builder is pure and deterministic (no clock, no storage, no DOM). */
export interface ReceiptInput {
  /** The finished post text the receipt certifies. */
  readonly text: string;
  /**
   * Lifetime count of fluff-free checks (the `fluff.clean` telemetry
   * counter), used as the running "#N" tally. The caller bumps the counter
   * first, then passes the post-bump value so a clean receipt reads "#7"
   * on the 7th clean check.
   */
  readonly cleanChecks: number;
  /** Calendar date, `YYYY-MM-DD` — passed in for determinism. */
  readonly date: string;
  /** Extension version, e.g. `0.1.1` — passed in (no import of package.json). */
  readonly version: string;
}

/** The computed, render-ready receipt facts. */
export interface ReceiptData {
  readonly cliches: number;
  readonly tellsFound: number;
  readonly unsourced: number;
  readonly styledGlyphs: number;
  readonly words: number;
  readonly chars: number;
  readonly cleanChecks: number;
  /** Clean iff no clichés, no remaining AI tells, no unsourced claims. */
  readonly clean: boolean;
  readonly date: string;
  readonly version: string;
}

/**
 * Aggregate the three pure reporters + the styled-glyph count into the
 * render-ready facts. DRY: the receipt never re-implements a rule — it
 * reads `reportFluff().matches`, `stripTells().changes`, and
 * `reportGrounding().flags` so it can never drift from the gates the user
 * already trusts.
 */
export function gatherReceipt(input: ReceiptInput): ReceiptData {
  const fluff = reportFluff(input.text);
  const tells = stripTells(input.text);
  const grounding = reportGrounding(input.text);

  const cliches = fluff.matches.length;
  const tellsFound = tells.changes.length;
  const unsourced = grounding.flags.length;

  return {
    cliches,
    tellsFound,
    unsourced,
    styledGlyphs: countStyledGlyphs(input.text),
    words: fluff.wordCount,
    chars: fluff.charCount,
    cleanChecks: input.cleanChecks,
    clean: cliches === 0 && tellsFound === 0 && unsourced === 0,
    date: input.date,
    version: input.version,
  };
}

/** Inner content width of the receipt body (characters). */
const WIDTH = 21;
const RULE = "  " + "─".repeat(WIDTH);

/** One `label ......... value` row, dot-leader aligned to WIDTH. */
function row(label: string, value: number): string {
  const v = String(value);
  const dots = Math.max(2, WIDTH - label.length - v.length - 2);
  return `  ${label} ${".".repeat(dots)} ${v}`;
}

/** Human summary of what is off, for the NEEDS WORK header. */
function fixSummary(d: ReceiptData): string {
  const parts: string[] = [];
  if (d.cliches > 0) parts.push(`${d.cliches} cliché${d.cliches === 1 ? "" : "s"}`);
  if (d.tellsFound > 0) parts.push(`${d.tellsFound} tell${d.tellsFound === 1 ? "" : "s"}`);
  if (d.unsourced > 0) {
    parts.push(`${d.unsourced} unsourced claim${d.unsourced === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/**
 * Render the monospace receipt. Pure string transform — deterministic for a
 * given ReceiptData. Designed for a fixed-width font (the side panel + a
 * pasted screenshot); reads as a charming till-receipt.
 */
export function formatReceipt(d: ReceiptData): string {
  const lines: string[] = [];
  lines.push("     ·  grip-post  ·");
  lines.push(RULE);
  lines.push(d.clean ? "     CLEAN RECEIPT" : "     NEEDS WORK");
  lines.push(RULE);
  lines.push(row("clichés", d.cliches));
  lines.push(row("AI tells", d.tellsFound));
  lines.push(row("unsourced", d.unsourced));
  lines.push(RULE);
  lines.push(row("words", d.words));
  lines.push(row("characters", d.chars));
  lines.push(row("Unicode styled", d.styledGlyphs));
  lines.push(RULE);

  if (d.styledGlyphs > 0) {
    lines.push("  ⚠ styled Unicode reads");
    lines.push("    letter-by-letter on");
    lines.push("    screen readers");
    lines.push(RULE);
  }

  if (!d.clean) {
    lines.push(`  → fix ${fixSummary(d)}`);
    lines.push("    before you post");
    lines.push(RULE);
  }

  if (d.clean) {
    lines.push(`  ✓ fluff-free check #${d.cleanChecks}`);
  } else {
    lines.push(`  · ${d.cleanChecks} fluff-free so far`);
  }
  lines.push("  ✓ nothing left your device");
  lines.push(`  ${d.date} · v${d.version}`);
  return lines.join("\n");
}

/** One-call convenience: gather + format. */
export function buildReceipt(input: ReceiptInput): string {
  return formatReceipt(gatherReceipt(input));
}
