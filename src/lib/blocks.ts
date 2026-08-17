// grip-post blocks — LINE-level transforms for LinkedIn posts.
// Pure transforms: no DOM, no chrome.*, no clipboard, no side effects.
//
// Every function maps a multi-line string to a multi-line string, one output
// line per input line (quoteBlock is the one documented exception — it adds a
// blank line above and below so LinkedIn renders the quote as its own
// paragraph block). Markers, and their inverses in `stripLinePrefixes`, both
// read from ONE table per family, so a marker can never be changed in one
// place and left stale in the other.

/** Bullet marker identifiers exposed to callers. */
export type BulletKey =
  | "dot"
  | "arrow"
  | "triangle"
  | "square"
  | "check"
  | "star"
  | "dash"
  | "sparkle";

/** Numbered-list marker identifiers exposed to callers. */
export type NumberKey = "plain" | "circled" | "filled" | "paren";

interface BulletSpec {
  readonly marker: string;
  readonly label: string;
}

/**
 * One row per bullet, and the row is the only definition — `bulletList` and
 * `stripLinePrefixes` both read from here. Every marker is a single BMP
 * codepoint, which is what lets the stripper match on `line[0]`.
 */
const BULLETS = {
  dot: { marker: "•", label: "Dot" }, // •
  arrow: { marker: "→", label: "Arrow" }, // →
  triangle: { marker: "▸", label: "Triangle" }, // ▸
  square: { marker: "▪", label: "Square" }, // ▪
  check: { marker: "✓", label: "Check" }, // ✓
  star: { marker: "★", label: "Star" }, // ★
  dash: { marker: "—", label: "Dash" }, // —
  sparkle: { marker: "✦", label: "Sparkle" }, // ✦
} as const satisfies Record<BulletKey, BulletSpec>;

const BULLET_KEYS = Object.keys(BULLETS) as readonly BulletKey[];
const BULLET_MARKERS: ReadonlySet<string> = new Set(
  BULLET_KEYS.map((key) => BULLETS[key].marker),
);

/**
 * An ASCII numeral form paired with the pattern that removes it again. The
 * two live together so a change to the rendered form cannot leave the
 * stripper matching the old one.
 */
interface AsciiMarker {
  readonly render: (n: number) => string;
  readonly pattern: RegExp;
}

const PLAIN_MARKER: AsciiMarker = {
  render: (n: number) => `${n}.`,
  pattern: /^\d+\. /,
};

const PAREN_MARKER: AsciiMarker = {
  render: (n: number) => `(${n})`,
  pattern: /^\(\d+\) /,
};

interface NumberSpec {
  readonly label: string;
  /** First codepoint of the glyph run, or null when the marker is ASCII. */
  readonly base: number | null;
  /** Highest ordinal the glyph run covers; past it, `ascii` takes over. */
  readonly limit: number;
  /** ASCII form — used outright by plain/paren, and as the fallback past `limit`. */
  readonly ascii: AsciiMarker;
}

/**
 * The two glyph runs are FINITE and their successors are not continuations:
 * U+2474 (the codepoint after circled 20) starts the parenthesised run ⑴, and
 * U+2780 (after filled 10) restarts the count visually at ➀. Running off
 * either end would therefore renumber the list silently, so past `limit` both
 * fall back to plain digits.
 */
const NUMBERS = {
  plain: { label: "Plain", base: null, limit: 0, ascii: PLAIN_MARKER },
  circled: { label: "Circled", base: 0x2460, limit: 20, ascii: PLAIN_MARKER }, // ①..⑳
  filled: { label: "Filled", base: 0x2776, limit: 10, ascii: PLAIN_MARKER }, // ❶..❿
  paren: { label: "Parenthesised", base: null, limit: 0, ascii: PAREN_MARKER },
} as const satisfies Record<NumberKey, NumberSpec>;

const NUMBER_KEYS = Object.keys(NUMBERS) as readonly NumberKey[];
const ASCII_MARKERS: readonly AsciiMarker[] = [
  ...new Set<AsciiMarker>(NUMBER_KEYS.map((key) => NUMBERS[key].ascii)),
];

/** U+258F LEFT ONE EIGHTH BLOCK — the quote rule. */
const QUOTE_MARK = "▏"; // ▏
const QUOTE_PREFIX = `${QUOTE_MARK} `;

/**
 * Three U+2007 FIGURE SPACEs. LinkedIn's renderer collapses runs of ordinary
 * leading spaces, so a plain-space indent vanishes on publish; U+2007 is a
 * non-collapsing space of digit width and survives intact.
 */
const INDENT = "   ";

interface SplitLines {
  readonly lines: readonly string[];
  readonly trailingNewline: boolean;
}

/**
 * Split into lines, normalising CRLF (and a lone CR) to LF, and remembering
 * whether the input ended in a newline so the caller can put it back. The
 * final newline is held aside rather than treated as an empty last line, so a
 * per-line prefix is never appended after it.
 */
function splitLines(s: string): SplitLines {
  const normalised = s.replace(/\r\n?/g, "\n");
  const trailingNewline = normalised.endsWith("\n");
  const body = trailingNewline ? normalised.slice(0, -1) : normalised;
  return { lines: body.split("\n"), trailingNewline };
}

function joinLines(lines: readonly string[], trailingNewline: boolean): string {
  return lines.join("\n") + (trailingNewline ? "\n" : "");
}

/** A line is blank when it holds nothing but whitespace. */
function isBlank(line: string): boolean {
  return line.trim() === "";
}

/**
 * Prefix every non-blank line with a bullet and one space. Blank lines are
 * left exactly as they are: on LinkedIn a blank line separates paragraphs, and
 * bulleting it would publish an orphan marker with no text beside it.
 */
export function bulletList(s: string, kind: BulletKey): string {
  const { lines, trailingNewline } = splitLines(s);
  const { marker } = BULLETS[kind];
  const out = lines.map((line) => (isBlank(line) ? line : `${marker} ${line}`));
  return joinLines(out, trailingNewline);
}

/** The marker for ordinal `n`, falling back to plain digits past the glyph run. */
function numberMarker(kind: NumberKey, n: number): string {
  const { base, limit, ascii } = NUMBERS[kind];
  if (base !== null && n >= 1 && n <= limit) {
    return String.fromCodePoint(base + n - 1);
  }
  return ascii.render(n);
}

/**
 * Number every non-blank line from 1. Blank lines are left alone AND skipped
 * in the count, so a list broken across paragraphs keeps counting rather than
 * restarting or wasting an ordinal on the gap.
 */
export function numberList(s: string, kind: NumberKey): string {
  const { lines, trailingNewline } = splitLines(s);
  let n = 0;
  const out = lines.map((line) => {
    if (isBlank(line)) return line;
    n += 1;
    return `${numberMarker(kind, n)} ${line}`;
  });
  return joinLines(out, trailingNewline);
}

/**
 * Draw a quote rule down the whole block. Every line is prefixed, blank ones
 * included, so the vertical rule runs unbroken through internal paragraph
 * breaks; one blank line above and below detaches the block from the
 * surrounding post so LinkedIn renders it as a paragraph of its own.
 */
export function quoteBlock(s: string): string {
  const { lines, trailingNewline } = splitLines(s);
  const quoted = lines.map((line) => `${QUOTE_PREFIX}${line}`);
  return joinLines(["", ...quoted, ""], trailingNewline);
}

/** Indent every non-blank line by three figure spaces (see `INDENT`). */
export function indentBlock(s: string): string {
  const { lines, trailingNewline } = splitLines(s);
  const out = lines.map((line) => (isBlank(line) ? line : `${INDENT}${line}`));
  return joinLines(out, trailingNewline);
}

function stripQuote(line: string): string | null {
  return line.startsWith(QUOTE_PREFIX) ? line.slice(QUOTE_PREFIX.length) : null;
}

function stripIndent(line: string): string | null {
  return line.startsWith(INDENT) ? line.slice(INDENT.length) : null;
}

function stripBullet(line: string): string | null {
  const head = line.slice(0, 1);
  return BULLET_MARKERS.has(head) && line[1] === " " ? line.slice(2) : null;
}

/** Remove a circled or filled numeral. Both runs are single BMP codepoints. */
function stripNumberGlyph(line: string): string | null {
  const cp = line.codePointAt(0);
  if (cp === undefined || line[1] !== " ") return null;
  for (const key of NUMBER_KEYS) {
    const { base, limit } = NUMBERS[key];
    if (base !== null && cp >= base && cp < base + limit) return line.slice(2);
  }
  return null;
}

function stripAsciiNumber(line: string): string | null {
  for (const { pattern } of ASCII_MARKERS) {
    const match = pattern.exec(line);
    if (match) return line.slice(match[0].length);
  }
  return null;
}

const STRIPPERS: ReadonlyArray<(line: string) => string | null> = [
  stripQuote,
  stripIndent,
  stripBullet,
  stripNumberGlyph,
  stripAsciiNumber,
];

/**
 * Remove at most ONE prefix from a line. Exactly one is the load-bearing
 * rule: text that already began with a bullet or a numeral gets a second one
 * added by the list functions, and removing only the added prefix is what
 * makes strip their exact inverse.
 */
function stripOne(line: string): string {
  for (const strip of STRIPPERS) {
    const stripped = strip(line);
    if (stripped !== null) return stripped;
  }
  return line;
}

/**
 * Remove the blank line `quoteBlock` puts above and below the rule, and only
 * that. The bottom pad and a preserved trailing newline are the same bytes, so
 * this works on the string rather than a line array: one final empty element is
 * allowed through as that preserved newline, and every other inner line must
 * carry the quote prefix before the padding is touched. Text that merely
 * happens to begin and end with a blank line is returned untouched.
 */
function unpadQuote(s: string): string {
  if (!s.startsWith("\n") || !s.endsWith("\n")) return s;
  const inner = s.slice(1, -1);
  const lines = inner.split("\n");
  const quoted = lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;
  if (quoted.length === 0) return s;
  if (!quoted.every((line) => line.startsWith(QUOTE_PREFIX))) return s;
  return inner;
}

/**
 * Undo any prefix these functions add — bullets, all four numeral forms, the
 * quote rule (including its blank padding) and the figure-space indent — so a
 * reader can change their mind about a block without retyping it.
 */
export function stripLinePrefixes(s: string): string {
  const normalised = s.replace(/\r\n?/g, "\n");
  const { lines, trailingNewline } = splitLines(unpadQuote(normalised));
  return joinLines(lines.map(stripOne), trailingNewline);
}

/** Human labels for bullet buttons. */
export const BULLET_LABELS: Readonly<Record<BulletKey, string>> = Object.freeze(
  Object.fromEntries(
    BULLET_KEYS.map((key) => [key, BULLETS[key].label]),
  ) as Record<BulletKey, string>,
);

/** Human labels for numbered-list buttons. */
export const NUMBER_LABELS: Readonly<Record<NumberKey, string>> = Object.freeze(
  Object.fromEntries(
    NUMBER_KEYS.map((key) => [key, NUMBERS[key].label]),
  ) as Record<NumberKey, string>,
);
