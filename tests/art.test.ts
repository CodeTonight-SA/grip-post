import { describe, it, expect } from "vitest";
import {
  divider,
  progressBar,
  sparkline,
  starRating,
  calloutBox,
  DIVIDER_SAMPLES,
  type DividerKey,
} from "../src/lib/art";

// Independent grapheme oracle. Deliberately NOT imported from the module under
// test — a test that measures with the same helper the implementation used
// would pass even if that helper were wrong.
const SEG = new Intl.Segmenter("en", { granularity: "grapheme" });
const gLen = (s: string): number => [...SEG.segment(s)].length;

const ALL_KEYS: readonly DividerKey[] = [
  "heavy",
  "double",
  "dotted",
  "dashed",
  "wave",
  "stars",
  "fade",
];

describe("divider — verified glyph literals", () => {
  it("heavy is U+2501 ━", () => expect(divider("heavy", 1)).toBe("━"));
  it("double is U+2550 ═", () => expect(divider("double", 1)).toBe("═"));
  it("dotted is U+2504 ┄", () => expect(divider("dotted", 1)).toBe("┄"));
  it("dashed is U+2508 ┈", () => expect(divider("dashed", 1)).toBe("┈"));
  it("wave is U+3030 〰", () => expect(divider("wave", 1)).toBe("〰"));
  it("stars starts with U+2726 ✦", () =>
    expect(divider("stars", 1)).toBe("✦"));
  it("fade starts with U+2593 ▓", () =>
    expect(divider("fade", 1)).toBe("▓"));
});

describe("divider — width discipline", () => {
  it("defaults to 24 glyphs for every kind", () => {
    for (const key of ALL_KEYS) expect([...divider(key)]).toHaveLength(24);
  });

  it("produces exactly `width` graphemes across kinds and widths", () => {
    for (const key of ALL_KEYS) {
      for (const w of [1, 2, 3, 5, 8, 17, 40, 199, 200]) {
        expect([...divider(key, w)]).toHaveLength(w);
      }
    }
  });

  it("returns empty string at width 0 and for negative widths", () => {
    for (const key of ALL_KEYS) {
      expect(divider(key, 0)).toBe("");
      expect(divider(key, -5)).toBe("");
    }
  });

  it("clamps above 200 and floors fractional widths", () => {
    expect([...divider("heavy", 500)]).toHaveLength(200);
    expect([...divider("heavy", 3.9)]).toHaveLength(3);
  });

  it("treats a non-finite width as zero rather than throwing", () => {
    expect(divider("heavy", Number.NaN)).toBe("");
    expect(divider("heavy", Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("divider — pattern behaviour", () => {
  it("cycles stars ✦✧✦✧ rather than repeating one glyph", () => {
    expect(divider("stars", 4)).toBe("✦✧✦✧");
  });

  it("repeats a single glyph for the plain rules", () => {
    expect(divider("heavy", 4)).toBe("━━━━");
  });

  it("fade steps evenly through ▓▒░ across the full width", () => {
    expect(divider("fade", 24)).toBe(
      "▓".repeat(8) + "▒".repeat(8) + "░".repeat(8),
    );
  });

  it("fade never gets darker left to right, at any width", () => {
    const ramp = ["▓", "▒", "░"];
    for (const w of [1, 2, 3, 4, 7, 10, 24, 50, 100]) {
      const density = [...divider("fade", w)].map((c) => ramp.indexOf(c));
      expect(density).not.toContain(-1);
      for (let i = 1; i < density.length; i += 1) {
        expect(density[i]).toBeGreaterThanOrEqual(density[i - 1]);
      }
    }
  });

  it("fade is a gradient, not a repeat — it ends lighter than it starts", () => {
    const faded = [...divider("fade", 24)];
    expect(faded[0]).toBe("▓");
    expect(faded[faded.length - 1]).toBe("░");
  });
});

describe("DIVIDER_SAMPLES", () => {
  it("covers exactly the seven divider keys", () => {
    expect(Object.keys(DIVIDER_SAMPLES).sort()).toEqual([...ALL_KEYS].sort());
  });

  it("is derived from divider(), so a preview cannot go stale", () => {
    for (const key of ALL_KEYS) expect(DIVIDER_SAMPLES[key]).toBe(divider(key));
  });

  it("renders each sample at the default 24 graphemes", () => {
    for (const key of ALL_KEYS) expect([...DIVIDER_SAMPLES[key]]).toHaveLength(24);
  });
});

describe("progressBar — numeric edges", () => {
  const bar = (out: string): string => out.split(" ")[0];
  const suffix = (out: string): string => out.split(" ")[1];

  it("draws an empty bar at 0%", () =>
    expect(progressBar(0)).toBe("░".repeat(10) + " 0%"));

  it("rounds 1% down to no filled block but reports 1%", () =>
    expect(progressBar(1)).toBe("░".repeat(10) + " 1%"));

  it("rounds 49% half-up to five blocks", () =>
    expect(progressBar(49)).toBe("█".repeat(5) + "░".repeat(5) + " 49%"));

  it("draws half at 50%", () =>
    expect(progressBar(50)).toBe("█".repeat(5) + "░".repeat(5) + " 50%"));

  it("rounds 99% up to a full bar, with the number as the precise signal", () => {
    expect(bar(progressBar(99))).toBe("█".repeat(10));
    expect(suffix(progressBar(99))).toBe("99%");
  });

  it("fills completely at 100%", () =>
    expect(progressBar(100)).toBe("█".repeat(10) + " 100%"));

  it("clamps -5 up to 0%", () => expect(progressBar(-5)).toBe(progressBar(0)));
  it("clamps 150 down to 100%", () =>
    expect(progressBar(150)).toBe(progressBar(100)));
  it("treats a non-finite percentage as 0%", () =>
    expect(progressBar(Number.NaN)).toBe(progressBar(0)));
});

describe("progressBar — invariants", () => {
  it("bar length always equals width, for every percent and width", () => {
    for (const w of [0, 1, 3, 7, 10, 20, 33]) {
      for (let p = 0; p <= 100; p += 1) {
        const [bar] = progressBar(p, w).split(" ");
        expect([...bar]).toHaveLength(w);
      }
    }
  });

  it("uses only █ and ░ in the bar, and a plain integer suffix", () => {
    for (let p = 0; p <= 100; p += 7) {
      const [bar, tail] = progressBar(p, 12).split(" ");
      expect([...bar].every((c) => c === "█" || c === "░")).toBe(true);
      expect(tail).toMatch(/^\d+%$/);
    }
  });

  it("filled blocks never decrease as the percentage rises", () => {
    let previous = 0;
    for (let p = 0; p <= 100; p += 1) {
      const filled = [...progressBar(p, 20).split(" ")[0]].filter(
        (c) => c === "█",
      ).length;
      expect(filled).toBeGreaterThanOrEqual(previous);
      previous = filled;
    }
  });

  it("clamps width to [0, 200]", () => {
    expect([...progressBar(50, -3).split(" ")[0]]).toHaveLength(0);
    expect([...progressBar(50, 900).split(" ")[0]]).toHaveLength(200);
  });
});

describe("sparkline", () => {
  it("returns an empty string for an empty series", () =>
    expect(sparkline([])).toBe(""));

  it("emits one grapheme per value", () => {
    for (const values of [[1], [1, 2], [3, 1, 4, 1, 5, 9, 2, 6], [0, 0, 0, 0]]) {
      expect([...sparkline(values)]).toHaveLength(values.length);
    }
  });

  it("maps an even ascending run onto the full ▁..█ ramp", () => {
    expect(sparkline([1, 2, 3, 4, 5, 6, 7, 8])).toBe(
      "▁▂▃▄▅▆▇█",
    );
  });

  it("puts the minimum at ▁ and the maximum at █", () => {
    const out = [...sparkline([4, -2, 17, 9])];
    expect(out[1]).toBe("▁");
    expect(out[2]).toBe("█");
  });

  it("draws the middle block when every value is equal, never NaN", () => {
    const out = sparkline([5, 5, 5]);
    expect(out).toBe("▄▄▄");
    expect(out).not.toContain("NaN");
  });

  it("handles a single value without dividing by zero", () =>
    expect(sparkline([42])).toBe("▄"));

  it("keeps its length when a value is not finite", () => {
    const out = sparkline([1, Number.NaN, 3]);
    expect([...out]).toHaveLength(3);
    expect(out).toBe("▄▄▄");
  });

  it("keeps its length when a value is Infinity", () => {
    expect([...sparkline([1, Number.POSITIVE_INFINITY, 3])]).toHaveLength(3);
  });

  it("scales a negative range identically to the same range shifted positive", () => {
    // Translation invariance: only the span matters, not where it sits. -5 is
    // the exact midpoint of [-10, 0], so half-up rounding lands on ▅ (index 4),
    // not ▄ — the same block the shifted series produces.
    expect(sparkline([-10, -5, 0])).toBe(sparkline([0, 5, 10]));
    expect(sparkline([-10, -5, 0])).toBe("▁▅█");
  });
});

describe("starRating", () => {
  it("draws three of five as ★★★☆☆", () =>
    expect(starRating(3)).toBe("★★★☆☆"));

  it("always emits exactly `outOf` stars", () => {
    for (const outOf of [0, 1, 3, 5, 10]) {
      for (const score of [-4, 0, 0.4, 1, 2.5, 4.9, 7, 99]) {
        expect([...starRating(score, outOf)]).toHaveLength(outOf);
      }
    }
  });

  it("rounds half-up to whole stars — 3.5 fills four, 3.4 fills three", () => {
    expect(starRating(3.5)).toBe("★".repeat(4) + "☆");
    expect(starRating(3.4)).toBe("★".repeat(3) + "☆".repeat(2));
  });

  it("clamps a negative score to none filled", () =>
    expect(starRating(-2)).toBe("☆".repeat(5)));

  it("clamps an over-range score to all filled", () =>
    expect(starRating(99)).toBe("★".repeat(5)));

  it("supports a different scale", () =>
    expect(starRating(2, 3)).toBe("★★☆"));

  it("returns an empty string for a zero or negative scale", () => {
    expect(starRating(3, 0)).toBe("");
    expect(starRating(3, -1)).toBe("");
  });

  it("uses only ★ and ☆", () => {
    expect(
      [...starRating(2.5, 6)].every((c) => c === "★" || c === "☆"),
    ).toBe(true);
  });
});

describe("calloutBox — alignment, which is the entire point", () => {
  const lines = (text: string): string[] => calloutBox(text).split("\n");

  it("gives every rendered line an identical grapheme length", () => {
    for (const text of [
      "hello",
      "hello\nworld",
      "a\nlonger line here\nbb",
      "Ship it\n2026\nGRIP",
      "",
    ]) {
      const rendered = lines(text);
      const widths = new Set(rendered.map(gLen));
      expect(widths.size).toBe(1);
    }
  });

  it("stays aligned when lines mix converted letters with passed-through punctuation", () => {
    // The killer case. "ab" becomes two astral monospace glyphs (4 UTF-16
    // units); "!!" passes through as two BMP characters (2 UTF-16 units).
    // Both are two graphemes. An implementation that padded by String.length
    // would add two spurious spaces to the second line and go ragged here.
    const rendered = lines("ab\n!!");
    expect(new Set(rendered.map(gLen)).size).toBe(1);

    const [, first, second] = rendered;
    expect(first.length).not.toBe(second.length); // the astral trap is live
    expect(gLen(first)).toBe(gLen(second)); // and the box survives it
  });

  it("counts a ZWJ emoji cluster as one column", () => {
    const family = "\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}";
    const rendered = lines(`${family}\nab`);
    expect(new Set(rendered.map(gLen)).size).toBe(1);
  });

  it("sizes the box to the longest line", () => {
    const rendered = lines("ab\nabcdef");
    expect(gLen(rendered[0])).toBe(6 + 4); // longest line + 2 pads + 2 borders
  });

  it("frames an empty string as a minimal three-line box", () => {
    const rendered = lines("");
    expect(rendered).toHaveLength(3);
    for (const line of rendered) expect(gLen(line)).toBe(4);
  });

  it("normalises CRLF so a Windows paste does not gain blank rows", () => {
    expect(calloutBox("a\r\nb")).toBe(calloutBox("a\nb"));
  });
});

describe("calloutBox — structure and monospace conversion", () => {
  const rendered = calloutBox("hi\nthere");

  it("draws the verified box-drawing corners and edges", () => {
    const rows = rendered.split("\n");
    expect(rows[0].startsWith("┌")).toBe(true);
    expect(rows[0].endsWith("┐")).toBe(true);
    expect(rows[rows.length - 1].startsWith("└")).toBe(true);
    expect(rows[rows.length - 1].endsWith("┘")).toBe(true);
    expect([...rows[0]].slice(1, -1).every((c) => c === "─")).toBe(true);
    for (const row of rows.slice(1, -1)) {
      expect(row.startsWith("│")).toBe(true);
      expect(row.endsWith("│")).toBe(true);
    }
  });

  it("converts letters to Mathematical Monospace", () => {
    expect(calloutBox("A")).toContain("\u{1D670}");
    expect(calloutBox("a")).toContain("\u{1D68A}");
    expect(calloutBox("0")).toContain("\u{1D7F6}");
  });

  it("pads with U+2007 FIGURE SPACE, not U+0020", () => {
    expect(calloutBox("hi")).toContain(" ");
    expect(calloutBox("hi")).not.toContain(" ");
  });

  it("emits no unassigned codepoints across the whole alphabet and digits", () => {
    const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const content = calloutBox(source)
      .split("\n")[1]
      .replace(/[│ ]/g, "");
    expect([...content]).toHaveLength(62);
    for (const ch of content) expect(ch).toMatch(/\p{L}|\p{N}|\p{S}/u);
  });

  it("passes characters outside A-Z a-z 0-9 through unchanged", () => {
    expect(calloutBox("é!")).toContain("é!");
  });
});
