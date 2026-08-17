// grip-post art — generated visual elements ("delight") for LinkedIn posts.
// Pure transforms only: no DOM, no chrome.*, no clipboard, no side effects.
//
// THE BINDING CONSTRAINT — this is why the module looks the way it does.
// LinkedIn renders post bodies in a PROPORTIONAL font. Any art whose meaning
// depends on equal character advance widths — ASCII tables, aligned columns,
// a box drawn around plain text — collapses into a ragged mess in the real
// feed. So every element here is one of two shapes:
//
//   (a) alignment-independent — a single repeated glyph, or a run of glyphs
//       that carries its meaning by SEQUENCE rather than by column position.
//       Dividers, progress bars, sparklines and star ratings are all this
//       shape: shuffle the pixel widths and they still read correctly.
//
//   (b) rendered in Unicode MONOSPACE (U+1D670 A-Z, U+1D68A a-z, U+1D7F6
//       0-9). Those glyphs resolve to a fixed-width fallback face, which is
//       the one honest way to make a drawn box line up in a proportional
//       context. calloutBox is the only element that needs it, and it is the
//       only element that draws a box.
//
// Honest limit on (b): font fallback is decided per character by the
// renderer, so exact pixel alignment is never ours to guarantee. What we can
// guarantee — and what the tests assert — is that every line of a box holds
// an identical number of GRAPHEMES, which is the necessary condition.
// Interior padding uses U+2007 FIGURE SPACE (defined as digit-width and
// intended for tabular alignment) rather than U+0020, which is guaranteed
// narrow in a proportional face.
//
// Every codepoint named below was verified on a real runtime before being
// written down, and each is pinned by a literal assertion in tests/art.test.ts.

/** Upper bound on any generated run, matching heavyHorizontal in the toolkit. */
const MAX_WIDTH = 200;

/** Clamp a number to [lo, hi]. Non-finite input falls back to `lo`. */
function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(Math.max(n, lo), hi);
}

/** Round half-up. Math.round is half-up only for non-negative input, and we
 *  want one deterministic rule everywhere rather than two subtly different
 *  ones, so the rounding is written out explicitly. */
function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

/** Shared width discipline: an integer in [0, MAX_WIDTH]. */
function clampWidth(width: number): number {
  return Math.floor(clamp(width, 0, MAX_WIDTH));
}

/** Grapheme segmenter, built once. Present on node 20+, Chrome and Safari
 *  14.1+; the null branch is the fallback path for anything older. */
const SEGMENTER =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

/** Split into grapheme clusters. Never use String.length on this module's
 *  output: the monospace glyphs are astral-plane characters and UTF-16 length
 *  double-counts every one of them, which is exactly how box padding goes
 *  wrong. Intl.Segmenter also keeps ZWJ emoji sequences as a single unit. */
function graphemes(s: string): string[] {
  if (SEGMENTER) return [...SEGMENTER.segment(s)].map((g) => g.segment);
  return [...s];
}

/** Count of grapheme clusters — the only width measure this module trusts. */
function graphemeLength(s: string): number {
  return graphemes(s).length;
}

// ---------------------------------------------------------------------------
// Dividers
// ---------------------------------------------------------------------------

/** Which divider to draw. */
export type DividerKey =
  | "heavy"
  | "double"
  | "dotted"
  | "dashed"
  | "wave"
  | "stars"
  | "fade";

type DividerMode = "cycle" | "ramp";

interface DividerSpec {
  readonly glyphs: readonly string[];
  readonly mode: DividerMode;
}

/**
 * One row per divider, and the row is the only definition — `divider` and
 * `DIVIDER_SAMPLES` both read from here, so a glyph can never be changed in
 * one place and left stale in another.
 *
 * `cycle` takes glyphs[i % n], which covers both a plain repeat (n = 1) and
 * an alternating pattern. `ramp` takes glyphs[floor(i * n / width)], which
 * steps evenly through the density scale across the whole run so the line
 * fades out toward its right-hand end instead of repeating.
 */
const DIVIDERS = {
  heavy: { glyphs: ["━"], mode: "cycle" }, // ━
  double: { glyphs: ["═"], mode: "cycle" }, // ═
  dotted: { glyphs: ["┄"], mode: "cycle" }, // ┄
  dashed: { glyphs: ["┈"], mode: "cycle" }, // ┈
  wave: { glyphs: ["〰"], mode: "cycle" }, // 〰
  stars: { glyphs: ["✦", "✧"], mode: "cycle" }, // ✦✧
  fade: { glyphs: ["▓", "▒", "░"], mode: "ramp" }, // ▓▒░
} as const satisfies Record<DividerKey, DividerSpec>;

const DIVIDER_KEYS = Object.keys(DIVIDERS) as readonly DividerKey[];

/** Width used for a bare `divider(kind)` and for every published sample. */
const DEFAULT_DIVIDER_WIDTH = 24;

/**
 * Draw a horizontal divider `width` glyphs wide, clamped to [0, 200].
 * A width of zero returns the empty string.
 *
 * Alignment-independent by construction: the line is a run of one repeated
 * or cycled glyph, so it reads the same however the font spaces it. `fade`
 * is the one gradient — it walks the ▓▒░ density ramp so the rule visibly
 * dissolves at its right-hand end rather than stopping abruptly.
 */
export function divider(kind: DividerKey, width = DEFAULT_DIVIDER_WIDTH): string {
  const w = clampWidth(width);
  const { glyphs, mode } = DIVIDERS[kind];
  const n = glyphs.length;
  let out = "";
  for (let i = 0; i < w; i += 1) {
    const index =
      mode === "ramp" ? Math.min(Math.floor((i * n) / w), n - 1) : i % n;
    out += glyphs[index];
  }
  return out;
}

/**
 * A rendered preview of every divider, for a picker UI. Derived from
 * `divider` at module load rather than typed out by hand, so the preview and
 * the output cannot drift apart.
 */
export const DIVIDER_SAMPLES: Readonly<Record<DividerKey, string>> =
  Object.freeze(
    DIVIDER_KEYS.reduce((acc, key) => {
      acc[key] = divider(key);
      return acc;
    }, {} as Record<DividerKey, string>),
  );

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

const BLOCK_FULL = "█"; // █
const BLOCK_EMPTY = "░"; // ░

/**
 * A progress bar of exactly `width` block glyphs followed by the percentage.
 * `percent` is clamped to [0, 100] and `width` to [0, 200].
 *
 * The bar length is always `width`, whatever the percentage — the filled and
 * empty runs are computed from one rounded count and its complement, so they
 * cannot drift apart by one, which is the classic bug here.
 *
 * Fill is rounded half-up, so at width 10 a value of 99 draws a full bar. The
 * numeric suffix is the precise signal; the bar is the glanceable one.
 */
export function progressBar(percent: number, width = 10): string {
  const w = clampWidth(width);
  const pct = clamp(percent, 0, 100);
  const filled = Math.min(roundHalfUp((pct / 100) * w), w);
  const bar = BLOCK_FULL.repeat(filled) + BLOCK_EMPTY.repeat(w - filled);
  return `${bar} ${roundHalfUp(pct)}%`;
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

/** ▁▂▃▄▅▆▇█ — the eight block-element heights, ascending. */
const SPARK_RAMP = [
  "▁",
  "▂",
  "▃",
  "▄",
  "▅",
  "▆",
  "▇",
  "█",
] as const;

/** ▄ — drawn when a value carries no usable height (see `sparkline`). */
const SPARK_MID = 3;

/**
 * One block glyph per value, scaled linearly between the minimum and the
 * maximum of the series. Output always holds exactly `values.length`
 * graphemes, and an empty series returns the empty string.
 *
 * Two degenerate cases collapse into one guard. When every value is equal the
 * range is zero, and when a value is not finite the arithmetic gives no
 * height either; both produce a non-finite index, and both then draw the
 * middle block. That is the honest rendering of "no signal here" and, more
 * importantly, it never yields NaN and never changes the output length.
 */
export function sparkline(values: readonly number[]): string {
  if (values.length === 0) return "";
  const min = values.reduce((a, b) => Math.min(a, b), Infinity);
  const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
  const top = SPARK_RAMP.length - 1;
  return values
    .map((v) => {
      const index = roundHalfUp(((v - min) / (max - min)) * top);
      if (!Number.isFinite(index)) return SPARK_RAMP[SPARK_MID];
      return SPARK_RAMP[Math.min(Math.max(index, 0), top)];
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Star rating
// ---------------------------------------------------------------------------

const STAR_FULL = "★"; // ★
const STAR_EMPTY = "☆"; // ☆

/**
 * A rating drawn as `outOf` stars, filled then empty, so the string always
 * holds exactly `outOf` graphemes. `score` is clamped to [0, outOf].
 *
 * Whole stars only, deliberately. There is no half-star glyph in the
 * widely-supported repertoire: U+2BE8 exists but arrived in Unicode 9.0 in
 * Miscellaneous Symbols and Arrows, where font coverage is thin enough that
 * it risks drawing as a tofu box in the feed. A rounded whole star that
 * always renders beats a half star that sometimes does not, so `score` is
 * rounded half-up instead.
 */
export function starRating(score: number, outOf = 5): string {
  const total = clampWidth(outOf);
  const filled = Math.min(roundHalfUp(clamp(score, 0, total)), total);
  return STAR_FULL.repeat(filled) + STAR_EMPTY.repeat(total - filled);
}

// ---------------------------------------------------------------------------
// Callout box
// ---------------------------------------------------------------------------

const MONO_BLOCKS = [
  { srcBase: 0x41, base: 0x1d670, count: 26 }, // A-Z → 𝙰-𝚉
  { srcBase: 0x61, base: 0x1d68a, count: 26 }, // a-z → 𝚊-𝚣
  { srcBase: 0x30, base: 0x1d7f6, count: 10 }, // 0-9 → 𝟶-𝟿
] as const;

/**
 * Mathematical Monospace for A-Z, a-z and 0-9; everything else passes
 * through untouched.
 *
 * Plain base-plus-offset arithmetic is safe for this block specifically,
 * because Mathematical Monospace is complete — it has no unassigned holes.
 * The script, fraktur and double-struck blocks do have holes, and naive
 * arithmetic there lands on unassigned codepoints that draw as tofu; those
 * need an explicit exception table and are not this module's business.
 *
 * Kept private on purpose: the box is the only thing here that needs
 * monospace, and owning the conversion locally means the alignment guarantee
 * cannot be broken by a change somewhere else in the toolkit.
 */
function toMonospace(s: string): string {
  return [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      const block = MONO_BLOCKS.find(
        (b) => cp >= b.srcBase && cp < b.srcBase + b.count,
      );
      return block ? String.fromCodePoint(cp - block.srcBase + block.base) : ch;
    })
    .join("");
}

/** ┌ ─ ┐ │ └ ┘ — light box drawing. */
const BOX = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
} as const;

/** U+2007 FIGURE SPACE — digit-width, intended for tabular alignment, and a
 *  far better bet than U+0020 beside fixed-width glyphs. */
const PAD = " ";

/**
 * A genuinely aligned callout box. The text is converted to Unicode
 * monospace first — that conversion is the whole reason the box holds its
 * shape in a proportional feed — then framed with light box-drawing
 * characters sized to the longest line.
 *
 * Multi-line input is supported and every line is padded out to the box
 * width, so all rendered lines carry an identical grapheme count. Padding is
 * measured in graphemes rather than UTF-16 units; measuring in UTF-16 would
 * double-count the astral monospace glyphs and produce a ragged right edge
 * the moment a line mixes converted letters with passed-through punctuation.
 */
export function calloutBox(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map(toMonospace);
  const inner = lines.reduce((w, line) => Math.max(w, graphemeLength(line)), 0);
  const rule = BOX.horizontal.repeat(inner + 2);
  const body = lines.map((line) => {
    const fill = PAD.repeat(inner - graphemeLength(line));
    return `${BOX.vertical}${PAD}${line}${fill}${PAD}${BOX.vertical}`;
  });
  return [
    `${BOX.topLeft}${rule}${BOX.topRight}`,
    ...body,
    `${BOX.bottomLeft}${rule}${BOX.bottomRight}`,
  ].join("\n");
}
