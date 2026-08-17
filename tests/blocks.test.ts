import { describe, it, expect } from "vitest";
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
} from "../src/lib/blocks";

const BULLET_KEYS: readonly BulletKey[] = [
  "dot",
  "arrow",
  "triangle",
  "square",
  "check",
  "star",
  "dash",
  "sparkle",
];

const NUMBER_KEYS: readonly NumberKey[] = ["plain", "circled", "filled", "paren"];

/** Three U+2007 FIGURE SPACEs — written as escapes because they are invisible. */
const FIG3 = "   ";

/**
 * Inputs for the round-trip property. Covers single lines, internal blank
 * lines, two blank-separated paragraphs, a preserved trailing newline, leading
 * and trailing blanks, the empty string, and lines that ALREADY start with
 * something the stripper recognises (the exactly-one-prefix anchor).
 */
const SAMPLES: readonly string[] = [
  "one",
  "one\ntwo\nthree",
  "one\n\ntwo",
  "first para line a\nfirst para line b\n\nsecond para line a\nsecond para line b",
  "one\ntwo\n",
  "\nleading blank",
  "\ninner\n",
  "",
  "\n",
  "• already bulleted",
  "1. already numbered",
  "(1) already parenthesised",
  "① already circled",
  "❶ already filled",
  `${FIG3}already indented`,
  "▏ already quoted",
  "line with trailing spaces   ",
  "2024. the year in review",
];

describe("bulletList", () => {
  it("prefixes with U+2022 • and one space", () =>
    expect(bulletList("ship it", "dot")).toBe("• ship it"));
  it("prefixes with U+2192 →", () =>
    expect(bulletList("ship it", "arrow")).toBe("→ ship it"));
  it("prefixes with U+25B8 ▸", () =>
    expect(bulletList("ship it", "triangle")).toBe("▸ ship it"));
  it("prefixes with U+25AA ▪", () =>
    expect(bulletList("ship it", "square")).toBe("▪ ship it"));
  it("prefixes with U+2713 ✓", () =>
    expect(bulletList("ship it", "check")).toBe("✓ ship it"));
  it("prefixes with U+2605 ★", () =>
    expect(bulletList("ship it", "star")).toBe("★ ship it"));
  it("prefixes with U+2014 —", () =>
    expect(bulletList("ship it", "dash")).toBe("— ship it"));
  it("prefixes with U+2726 ✦", () =>
    expect(bulletList("ship it", "sparkle")).toBe("✦ ship it"));

  it("every marker is a single codepoint of category Symbol or Punctuation", () => {
    for (const key of BULLET_KEYS) {
      const marker = [...bulletList("x", key)][0];
      expect(marker).toMatch(/^[\p{S}\p{P}]$/u);
    }
  });

  it("leaves blank lines blank — no orphan bullet on a paragraph break", () =>
    expect(bulletList("a\n\nb", "dot")).toBe("• a\n\n• b"));

  it("leaves a whitespace-only line untouched", () =>
    expect(bulletList("a\n   \nb", "dot")).toBe("• a\n   \n• b"));

  it("emits one output line per input line", () => {
    const input = "a\n\nb\nc";
    expect(bulletList(input, "star").split("\n")).toHaveLength(
      input.split("\n").length,
    );
  });

  it("preserves a trailing newline without bulleting past it", () =>
    expect(bulletList("a\nb\n", "dot")).toBe("• a\n• b\n"));

  it("adds no trailing newline when the input had none", () =>
    expect(bulletList("a", "dot").endsWith("\n")).toBe(false));

  it("normalises CRLF to LF", () =>
    expect(bulletList("a\r\nb", "dot")).toBe("• a\n• b"));

  it("normalises a lone CR to LF", () =>
    expect(bulletList("a\rb", "dot")).toBe("• a\n• b"));

  it("returns the empty string unchanged", () =>
    expect(bulletList("", "dot")).toBe(""));
});

describe("numberList", () => {
  it("numbers plain from 1", () =>
    expect(numberList("a\nb\nc", "plain")).toBe("1. a\n2. b\n3. c"));

  it("numbers paren from 1", () =>
    expect(numberList("a\nb", "paren")).toBe("(1) a\n(2) b"));

  it("numbers circled from U+2460 ①", () =>
    expect(numberList("a\nb\nc", "circled")).toBe("① a\n② b\n③ c"));

  it("numbers filled from U+2776 ❶", () =>
    expect(numberList("a\nb\nc", "filled")).toBe("❶ a\n❷ b\n❸ c"));

  it("skips blank lines in the count rather than restarting", () =>
    expect(numberList("a\n\nb", "plain")).toBe("1. a\n\n2. b"));

  it("leaves blank lines blank for every kind", () => {
    for (const key of NUMBER_KEYS) {
      expect(numberList("a\n\nb", key).split("\n")[1]).toBe("");
    }
  });

  it("preserves a trailing newline", () =>
    expect(numberList("a\n", "plain")).toBe("1. a\n"));

  it("normalises CRLF to LF", () =>
    expect(numberList("a\r\nb", "plain")).toBe("1. a\n2. b"));

  it("returns the empty string unchanged", () =>
    expect(numberList("", "circled")).toBe(""));
});

describe("numberList glyph-run boundaries", () => {
  const lines = (n: number) =>
    Array.from({ length: n }, (_, i) => `item ${i + 1}`).join("\n");

  it("circled item 20 is U+2473 ⑳", () =>
    expect(numberList(lines(20), "circled").split("\n")[19]).toBe("⑳ item 20"));

  it("circled item 21 falls back to plain '21. '", () =>
    expect(numberList(lines(21), "circled").split("\n")[20]).toBe("21. item 21"));

  it("circled item 21 is NOT U+2474 ⑴ — the run's successor is a different series", () => {
    const twentyFirst = numberList(lines(21), "circled").split("\n")[20];
    expect(twentyFirst.startsWith("⑴")).toBe(false);
  });

  it("filled item 10 is U+277F ❿", () =>
    expect(numberList(lines(10), "filled").split("\n")[9]).toBe("❿ item 10"));

  it("filled item 11 falls back to plain '11. '", () =>
    expect(numberList(lines(11), "filled").split("\n")[10]).toBe("11. item 11"));

  it("filled item 11 is NOT U+2780 ➀ — that glyph restarts the count at one", () => {
    const eleventh = numberList(lines(11), "filled").split("\n")[10];
    expect(eleventh.startsWith("➀")).toBe(false);
  });

  it("no numeral in either glyph run is an unassigned codepoint", () => {
    for (const key of ["circled", "filled"] as const) {
      for (const marker of numberList(lines(20), key)
        .split("\n")
        .map((line) => [...line][0])) {
        expect(marker).toMatch(/^[\p{L}\p{N}\p{S}]$/u);
      }
    }
  });
});

describe("quoteBlock", () => {
  it("prefixes with U+258F ▏ and pads with one blank line above and below", () =>
    expect(quoteBlock("a")).toBe("\n▏ a\n"));

  it("prefixes blank lines too, so the rule is unbroken", () =>
    expect(quoteBlock("a\n\nb")).toBe("\n▏ a\n▏ \n▏ b\n"));

  it("keeps two paragraphs distinguishable inside the block", () => {
    const out = quoteBlock("p1 l1\np1 l2\n\np2 l1");
    expect(out.split("\n")).toEqual([
      "",
      "▏ p1 l1",
      "▏ p1 l2",
      "▏ ",
      "▏ p2 l1",
      "",
    ]);
  });

  it("uses U+258F, not a full block or a pipe", () => {
    const bar = [...quoteBlock("a")][1];
    expect(bar.codePointAt(0)).toBe(0x258f);
    expect(bar).toBe("▏");
  });

  it("adds exactly two lines to the block", () => {
    const input = "a\nb\nc";
    expect(quoteBlock(input).split("\n")).toHaveLength(
      input.split("\n").length + 2,
    );
  });

  it("preserves a trailing newline after the bottom pad", () =>
    expect(quoteBlock("a\n")).toBe("\n▏ a\n\n"));

  it("normalises CRLF to LF", () =>
    expect(quoteBlock("a\r\nb")).toBe("\n▏ a\n▏ b\n"));
});

describe("indentBlock", () => {
  it("prefixes with three U+2007 figure spaces", () =>
    expect(indentBlock("a")).toBe(`${FIG3}a`));

  it("uses U+2007, not U+0020 — ordinary leading spaces are collapsed on publish", () => {
    const head = [...indentBlock("a")].slice(0, 3);
    expect(head.map((c) => c.codePointAt(0))).toEqual([0x2007, 0x2007, 0x2007]);
  });

  it("leaves blank lines blank", () =>
    expect(indentBlock("a\n\nb")).toBe(`${FIG3}a\n\n${FIG3}b`));

  it("preserves a trailing newline", () =>
    expect(indentBlock("a\n")).toBe(`${FIG3}a\n`));

  it("stacks on an already-indented line rather than collapsing it", () =>
    expect(indentBlock(`${FIG3}a`)).toBe(`${FIG3}${FIG3}a`));

  it("normalises CRLF to LF", () =>
    expect(indentBlock("a\r\nb")).toBe(`${FIG3}a\n${FIG3}b`));
});

describe("stripLinePrefixes", () => {
  it("removes a bullet", () => expect(stripLinePrefixes("• a")).toBe("a"));
  it("removes a plain numeral", () =>
    expect(stripLinePrefixes("1. a")).toBe("a"));
  it("removes a paren numeral", () =>
    expect(stripLinePrefixes("(7) a")).toBe("a"));
  it("removes a circled numeral", () =>
    expect(stripLinePrefixes("③ a")).toBe("a"));
  it("removes a filled numeral", () =>
    expect(stripLinePrefixes("❸ a")).toBe("a"));
  it("removes a figure-space indent", () =>
    expect(stripLinePrefixes(`${FIG3}a`)).toBe("a"));
  it("removes the quote rule and its padding", () =>
    expect(stripLinePrefixes("\n▏ a\n")).toBe("a"));

  it("removes at most ONE prefix per line", () =>
    expect(stripLinePrefixes("• • a")).toBe("• a"));

  it("leaves an unprefixed line alone", () =>
    expect(stripLinePrefixes("plain text")).toBe("plain text"));

  it("leaves a bullet with no following space alone", () =>
    expect(stripLinePrefixes("•nospace")).toBe("•nospace"));

  it("does not eat blank padding around text that is not a quote block", () =>
    expect(stripLinePrefixes("\nnot quoted\n")).toBe("\nnot quoted\n"));

  it("does not unpad when only some inner lines carry the quote rule", () =>
    expect(stripLinePrefixes("\n▏ a\nb\n")).toBe("\na\nb\n"));

  it("preserves a trailing newline", () =>
    expect(stripLinePrefixes("• a\n")).toBe("a\n"));

  it("normalises CRLF to LF", () =>
    expect(stripLinePrefixes("• a\r\n• b")).toBe("a\nb"));
});

describe("round-trip property — strip is the exact inverse", () => {
  for (const key of BULLET_KEYS) {
    it(`bulletList/${key} round-trips every sample`, () => {
      for (const sample of SAMPLES) {
        expect(stripLinePrefixes(bulletList(sample, key))).toBe(sample);
      }
    });
  }

  for (const key of NUMBER_KEYS) {
    it(`numberList/${key} round-trips every sample`, () => {
      for (const sample of SAMPLES) {
        expect(stripLinePrefixes(numberList(sample, key))).toBe(sample);
      }
    });
  }

  it("quoteBlock round-trips every sample", () => {
    for (const sample of SAMPLES) {
      expect(stripLinePrefixes(quoteBlock(sample))).toBe(sample);
    }
  });

  it("indentBlock round-trips every sample", () => {
    for (const sample of SAMPLES) {
      expect(stripLinePrefixes(indentBlock(sample))).toBe(sample);
    }
  });

  it("round-trips a 25-line circled list across the glyph-run boundary", () => {
    const sample = Array.from({ length: 25 }, (_, i) => `item ${i + 1}`).join("\n");
    expect(stripLinePrefixes(numberList(sample, "circled"))).toBe(sample);
  });

  it("round-trips a 15-line filled list across the glyph-run boundary", () => {
    const sample = Array.from({ length: 15 }, (_, i) => `item ${i + 1}`).join("\n");
    expect(stripLinePrefixes(numberList(sample, "filled"))).toBe(sample);
  });
});

describe("labels", () => {
  it("BULLET_LABELS covers every bullet key", () =>
    expect(Object.keys(BULLET_LABELS).sort()).toEqual([...BULLET_KEYS].sort()));

  it("NUMBER_LABELS covers every number key", () =>
    expect(Object.keys(NUMBER_LABELS).sort()).toEqual([...NUMBER_KEYS].sort()));

  it("every label is non-empty", () => {
    for (const label of [
      ...Object.values(BULLET_LABELS),
      ...Object.values(NUMBER_LABELS),
    ]) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("names the dot bullet and the circled numerals in plain words", () => {
    expect(BULLET_LABELS.dot).toBe("Dot");
    expect(NUMBER_LABELS.circled).toBe("Circled");
  });

  it("is frozen", () => {
    expect(Object.isFrozen(BULLET_LABELS)).toBe(true);
    expect(Object.isFrozen(NUMBER_LABELS)).toBe(true);
  });
});
