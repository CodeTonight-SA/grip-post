// grip-post styles — per-character style maps for LinkedIn text.
// Pure transforms: no DOM, no chrome.*, no clipboard, no side effects.
//
// Everything derives from ONE declarative table (STYLE_SPECS). A style is
// either a set of codepoint runs plus per-character overrides, or a combining
// mark appended after each grapheme cluster. Adding a style is one table
// entry; no new branching code is required anywhere else.

/** A contiguous run of source codepoints shifted onto a target block. */
interface Block {
  readonly srcBase: number;
  readonly base: number;
  readonly count: number;
}

/**
 * One style definition. `blocks` + `overrides` build the forward character
 * map (overrides win, and exist because several maths blocks have holes at
 * codepoints reserved for the Letterlike Symbols). `mark` is a combining
 * mark appended after each grapheme cluster; "" means the style has none.
 */
interface StyleSpec {
  readonly label: string;
  readonly blocks: readonly Block[];
  readonly overrides: Readonly<Record<string, number>>;
  readonly mark: string;
}

/** The style identifiers exposed to callers. */
export type StyleKey =
  | "bold"
  | "italic"
  | "bold-italic"
  | "mono"
  | "script"
  | "fraktur"
  | "double-struck"
  | "wide"
  | "underline"
  | "strike"
  | "super"
  | "sub";

const UPPER = 0x41; // 'A'
const LOWER = 0x61; // 'a'
const DIGIT = 0x30; // '0'

const NO_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({});

function run(srcBase: number, base: number, count: number): Block {
  return { srcBase, base, count };
}

/** Combining marks used by the mark-based styles. */
const UNDERLINE_MARK = "̲";
const STRIKE_MARK = "̶";

/**
 * Overrides for Mathematical Script. Naive arithmetic over U+1D49C lands on
 * unassigned codepoints for these letters; the assigned glyphs live in the
 * Letterlike Symbols block.
 */
const SCRIPT_OVERRIDES: Readonly<Record<string, number>> = {
  B: 0x212c,
  E: 0x2130,
  F: 0x2131,
  H: 0x210b,
  I: 0x2110,
  L: 0x2112,
  M: 0x2133,
  R: 0x211b,
  e: 0x212f,
  g: 0x210a,
  o: 0x2134,
};

/** Overrides for Mathematical Fraktur (holes at C H I R Z). */
const FRAKTUR_OVERRIDES: Readonly<Record<string, number>> = {
  C: 0x212d,
  H: 0x210c,
  I: 0x2111,
  R: 0x211c,
  Z: 0x2128,
};

/** Overrides for Mathematical Double-Struck (holes at C H N P Q R Z). */
const DOUBLE_STRUCK_OVERRIDES: Readonly<Record<string, number>> = {
  C: 0x2102,
  H: 0x210d,
  N: 0x2115,
  P: 0x2119,
  Q: 0x211a,
  R: 0x211d,
  Z: 0x2124,
};

/**
 * Superscript forms. Digits are complete but not contiguous — 1, 2 and 3
 * predate the U+207x run and live in Latin-1 Supplement. Letters are
 * incomplete in Unicode: q, C, F, Q, S, X, Y and Z have no superscript form
 * and therefore pass through unchanged.
 */
const SUPER_OVERRIDES: Readonly<Record<string, number>> = {
  "0": 0x2070,
  "1": 0x00b9,
  "2": 0x00b2,
  "3": 0x00b3,
  "4": 0x2074,
  "5": 0x2075,
  "6": 0x2076,
  "7": 0x2077,
  "8": 0x2078,
  "9": 0x2079,
  a: 0x1d43,
  b: 0x1d47,
  c: 0x1d9c,
  d: 0x1d48,
  e: 0x1d49,
  f: 0x1da0,
  g: 0x1d4d,
  h: 0x02b0,
  i: 0x2071,
  j: 0x02b2,
  k: 0x1d4f,
  l: 0x02e1,
  m: 0x1d50,
  n: 0x207f,
  o: 0x1d52,
  p: 0x1d56,
  r: 0x02b3,
  s: 0x02e2,
  t: 0x1d57,
  u: 0x1d58,
  v: 0x1d5b,
  w: 0x02b7,
  x: 0x02e3,
  y: 0x02b8,
  z: 0x1dbb,
  A: 0x1d2c,
  B: 0x1d2e,
  D: 0x1d30,
  E: 0x1d31,
  G: 0x1d33,
  H: 0x1d34,
  I: 0x1d35,
  J: 0x1d36,
  K: 0x1d37,
  L: 0x1d38,
  M: 0x1d39,
  N: 0x1d3a,
  O: 0x1d3c,
  P: 0x1d3e,
  R: 0x1d3f,
  T: 0x1d40,
  U: 0x1d41,
  V: 0x2c7d,
  W: 0x1d42,
};

/**
 * Subscript letters. Sparse in Unicode, so every letter without a subscript
 * form passes through unchanged. Digits need no entry here — they are a
 * clean contiguous run and are expressed as a block on the style itself.
 */
const SUB_OVERRIDES: Readonly<Record<string, number>> = {
  a: 0x2090,
  e: 0x2091,
  h: 0x2095,
  i: 0x1d62,
  j: 0x2c7c,
  k: 0x2096,
  l: 0x2097,
  m: 0x2098,
  n: 0x2099,
  o: 0x2092,
  p: 0x209a,
  r: 0x1d63,
  s: 0x209b,
  t: 0x209c,
  u: 0x1d64,
  v: 0x1d65,
  x: 0x2093,
};

/** The single source of truth. Every derived structure below reads this. */
const STYLE_SPECS: Readonly<Record<StyleKey, StyleSpec>> = {
  bold: {
    label: "Bold",
    blocks: [
      run(UPPER, 0x1d5d4, 26),
      run(LOWER, 0x1d5ee, 26),
      run(DIGIT, 0x1d7ec, 10),
    ],
    overrides: NO_OVERRIDES,
    mark: "",
  },
  italic: {
    label: "Italic",
    blocks: [run(UPPER, 0x1d608, 26), run(LOWER, 0x1d622, 26)],
    overrides: NO_OVERRIDES,
    mark: "",
  },
  "bold-italic": {
    label: "Bold italic",
    blocks: [run(UPPER, 0x1d63c, 26), run(LOWER, 0x1d656, 26)],
    overrides: NO_OVERRIDES,
    mark: "",
  },
  mono: {
    label: "Monospace",
    blocks: [
      run(UPPER, 0x1d670, 26),
      run(LOWER, 0x1d68a, 26),
      run(DIGIT, 0x1d7f6, 10),
    ],
    overrides: NO_OVERRIDES,
    mark: "",
  },
  script: {
    label: "Script",
    blocks: [run(UPPER, 0x1d49c, 26), run(LOWER, 0x1d4b6, 26)],
    overrides: SCRIPT_OVERRIDES,
    mark: "",
  },
  fraktur: {
    label: "Fraktur",
    blocks: [run(UPPER, 0x1d504, 26), run(LOWER, 0x1d51e, 26)],
    overrides: FRAKTUR_OVERRIDES,
    mark: "",
  },
  "double-struck": {
    label: "Double-struck",
    blocks: [
      run(UPPER, 0x1d538, 26),
      run(LOWER, 0x1d552, 26),
      run(DIGIT, 0x1d7d8, 10),
    ],
    overrides: DOUBLE_STRUCK_OVERRIDES,
    mark: "",
  },
  wide: {
    label: "Wide",
    blocks: [run(UPPER, 0xff21, 26), run(LOWER, 0xff41, 26), run(DIGIT, 0xff10, 10)],
    overrides: NO_OVERRIDES,
    mark: "",
  },
  underline: {
    label: "Underline",
    blocks: [],
    overrides: NO_OVERRIDES,
    mark: UNDERLINE_MARK,
  },
  strike: {
    label: "Strikethrough",
    blocks: [],
    overrides: NO_OVERRIDES,
    mark: STRIKE_MARK,
  },
  super: {
    label: "Superscript",
    blocks: [],
    overrides: SUPER_OVERRIDES,
    mark: "",
  },
  sub: {
    label: "Subscript",
    blocks: [run(DIGIT, 0x2080, 10)],
    overrides: SUB_OVERRIDES,
    mark: "",
  },
};

const STYLE_KEYS = Object.keys(STYLE_SPECS) as StyleKey[];

/** Expand one spec into its forward character map. Overrides win over blocks. */
function buildForward(spec: StyleSpec): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const block of spec.blocks) {
    for (let i = 0; i < block.count; i += 1) {
      map.set(
        String.fromCodePoint(block.srcBase + i),
        String.fromCodePoint(block.base + i),
      );
    }
  }
  for (const [src, cp] of Object.entries(spec.overrides)) {
    map.set(src, String.fromCodePoint(cp));
  }
  return map;
}

const FORWARD: Readonly<Record<StyleKey, ReadonlyMap<string, string>>> =
  Object.fromEntries(
    STYLE_KEYS.map((key) => [key, buildForward(STYLE_SPECS[key])]),
  ) as Record<StyleKey, ReadonlyMap<string, string>>;

/**
 * The reverse map, built by INVERTING the forward maps — never hand-written,
 * so a forward mapping and its undo cannot drift apart.
 */
const REVERSE: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const key of STYLE_KEYS) {
    for (const [src, target] of FORWARD[key]) map.set(target, src);
  }
  return map;
})();

/** Every combining mark used by the table, for stripping in toPlain. */
const MARKS: ReadonlySet<string> = new Set(
  STYLE_KEYS.map((key) => STYLE_SPECS[key].mark).filter((m) => m !== ""),
);

const GRAPHEME_SEGMENTER: Intl.Segmenter | null =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Split into grapheme clusters, falling back to codepoints where unavailable. */
function graphemes(s: string): string[] {
  if (GRAPHEME_SEGMENTER === null) return [...s];
  return [...GRAPHEME_SEGMENTER.segment(s)].map((part) => part.segment);
}

/** A combining mark on a line break is a rendering artefact, so skip those. */
function isLineBreak(cluster: string): boolean {
  return cluster === "\n" || cluster === "\r" || cluster === "\r\n";
}

function styleCluster(
  cluster: string,
  map: ReadonlyMap<string, string>,
  mark: string,
): string {
  const mapped =
    map.size === 0
      ? cluster
      : [...cluster].map((ch) => map.get(ch) ?? ch).join("");
  if (mark === "" || isLineBreak(cluster)) return mapped;
  return mapped + mark;
}

/**
 * Render `s` in the given style. Characters with no target glyph pass through
 * unchanged — an unassigned codepoint is never emitted. Already-styled text
 * passes through too (its characters lie outside the ASCII source range), so
 * applying a style twice is a no-op.
 */
export function applyStyle(key: StyleKey, s: string): string {
  const { mark } = STYLE_SPECS[key];
  const map = FORWARD[key];
  return graphemes(s)
    .map((cluster) => styleCluster(cluster, map, mark))
    .join("");
}

/**
 * Reverse every style back to plain ASCII — the toggle/undo primitive.
 * Strips the combining marks and reverses each styled codepoint via the
 * inverted table. Unstyled characters are returned untouched.
 */
export function toPlain(s: string): string {
  return [...s]
    .filter((ch) => !MARKS.has(ch))
    .map((ch) => REVERSE.get(ch) ?? ch)
    .join("");
}

/** Human labels for style buttons. */
export const STYLE_LABELS: Readonly<Record<StyleKey, string>> = Object.freeze(
  Object.fromEntries(
    STYLE_KEYS.map((key) => [key, STYLE_SPECS[key].label]),
  ) as Record<StyleKey, string>,
);

/** The word "Aa" rendered in each style, for button previews. */
export const STYLE_SAMPLES: Readonly<Record<StyleKey, string>> = Object.freeze(
  Object.fromEntries(
    STYLE_KEYS.map((key) => [key, applyStyle(key, "Aa")]),
  ) as Record<StyleKey, string>,
);
