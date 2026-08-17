import { describe, it, expect } from "vitest";
import {
  applyStyle,
  toPlain,
  STYLE_LABELS,
  STYLE_SAMPLES,
  type StyleKey,
} from "../src/lib/styles";
import { toBold, toItalic } from "../src/lib/unicode-toolkit";

const ALL_KEYS = Object.keys(STYLE_LABELS) as StyleKey[];

/** Styles that append a combining mark rather than swapping codepoints. */
const MARK_KEYS: readonly StyleKey[] = ["underline", "strike"];

const UPPERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERS = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const ALNUM = UPPERS + LOWERS + DIGITS;

const UNDERLINE = "̲";
const STRIKE = "̶";

/** Man-woman-girl family: one grapheme cluster built from five codepoints. */
const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}";

describe("style table completeness", () => {
  it("covers all twelve keys", () => {
    expect(ALL_KEYS).toHaveLength(12);
    expect(new Set(ALL_KEYS).size).toBe(12);
  });

  it("gives every key a non-empty human label", () => {
    for (const key of ALL_KEYS) {
      expect(STYLE_LABELS[key].length).toBeGreaterThan(0);
      expect(STYLE_LABELS[key]).not.toBe(key);
    }
  });

  it("labels bold as 'Bold' and double-struck as 'Double-struck'", () => {
    expect(STYLE_LABELS.bold).toBe("Bold");
    expect(STYLE_LABELS["double-struck"]).toBe("Double-struck");
  });

  it("gives every key an 'Aa' sample that differs from plain 'Aa'", () => {
    for (const key of ALL_KEYS) {
      expect(STYLE_SAMPLES[key]).not.toBe("Aa");
      expect(STYLE_SAMPLES[key]).toBe(applyStyle(key, "Aa"));
    }
  });

  it("renders the bold sample as the literal 𝗔𝗮", () => {
    expect(STYLE_SAMPLES.bold).toBe("𝗔𝗮");
  });

  it("renders the underline sample with a mark after each letter", () => {
    expect(STYLE_SAMPLES.underline).toBe(`A${UNDERLINE}a${UNDERLINE}`);
  });
});

describe("no unassigned codepoints (tofu sweep)", () => {
  it("emits no unassigned codepoint for any style over the whole alphabet", () => {
    for (const key of ALL_KEYS) {
      const out = applyStyle(key, ALNUM);
      for (const ch of out) {
        expect(
          /\p{Cn}/u.test(ch),
          `${key} produced unassigned U+${ch.codePointAt(0)!.toString(16)}`,
        ).toBe(false);
      }
    }
  });

  it("emits only letters, numbers or symbols for every codepoint-map style", () => {
    for (const key of ALL_KEYS) {
      if (MARK_KEYS.includes(key)) continue;
      for (const src of ALNUM) {
        for (const ch of applyStyle(key, src)) {
          expect(
            /\p{L}|\p{N}|\p{S}/u.test(ch),
            `${key} mapped ${src} to a non-letter U+${ch.codePointAt(0)!.toString(16)}`,
          ).toBe(true);
        }
      }
    }
  });

  it("emits exactly the source plus one mark per character for mark styles", () => {
    for (const key of MARK_KEYS) {
      const mark = key === "underline" ? UNDERLINE : STRIKE;
      expect(applyStyle(key, ALNUM)).toBe(
        [...ALNUM].map((ch) => ch + mark).join(""),
      );
    }
  });
});

describe("toPlain round-trip (the Goodhart anchor)", () => {
  it("reverses every style back to the exact source alphabet", () => {
    for (const key of ALL_KEYS) {
      expect(toPlain(applyStyle(key, ALNUM)), `round-trip failed for ${key}`).toBe(
        ALNUM,
      );
    }
  });

  it("reverses every style over the full printable ASCII range", () => {
    const printable = Array.from({ length: 95 }, (_, i) =>
      String.fromCharCode(32 + i),
    ).join("");
    for (const key of ALL_KEYS) {
      expect(toPlain(applyStyle(key, printable)), `failed for ${key}`).toBe(
        printable,
      );
    }
  });

  it("leaves already-plain text untouched", () => {
    expect(toPlain("Hello, world 42!")).toBe("Hello, world 42!");
  });

  it("strips underline and strike marks wherever they appear", () => {
    expect(toPlain(`H${UNDERLINE}i${STRIKE}`)).toBe("Hi");
  });

  it("is idempotent", () => {
    const styled = applyStyle("script", "Basement Frog 7");
    expect(toPlain(toPlain(styled))).toBe(toPlain(styled));
  });

  it("reverses a mixture of several styles in one string", () => {
    const mixed =
      applyStyle("bold", "abc") +
      applyStyle("fraktur", "DEF") +
      applyStyle("sub", "12") +
      applyStyle("wide", "z");
    expect(toPlain(mixed)).toBe("abcDEF12z");
  });

  it("has no reverse-map collisions across styles", () => {
    const source = new Map<string, string>();
    for (const key of ALL_KEYS) {
      if (MARK_KEYS.includes(key)) continue;
      for (const src of ALNUM) {
        const target = applyStyle(key, src);
        const seen = source.get(target);
        if (seen !== undefined) expect(seen).toBe(src);
        source.set(target, src);
      }
    }
    expect(source.size).toBeGreaterThan(300);
  });
});

describe("parity with the shipped unicode-toolkit", () => {
  const corpus = [
    "Hello, World 123",
    ALNUM,
    "line one\nline two\r\nline three",
    "café naïve é",
    `emoji ${FAMILY} tail`,
    "   ",
    "",
  ];

  it("bold is byte-identical to toBold", () => {
    for (const s of corpus) expect(applyStyle("bold", s)).toBe(toBold(s));
  });

  it("italic is byte-identical to toItalic", () => {
    for (const s of corpus) expect(applyStyle("italic", s)).toBe(toItalic(s));
  });

  it("agrees with toBold on the exact A/a/5 codepoints", () => {
    expect(applyStyle("bold", "A")).toBe("\u{1D5D4}");
    expect(applyStyle("bold", "a")).toBe("\u{1D5EE}");
    expect(applyStyle("bold", "5")).toBe("\u{1D7F1}");
  });
});

describe("hole-bearing blocks use the Letterlike Symbols", () => {
  it("maps script holes to the verified literals", () => {
    expect(applyStyle("script", "BEFHILMR")).toBe("ℬℰℱℋℐℒℳℛ");
    expect(applyStyle("script", "ego")).toBe("ℯℊℴ");
  });

  it("maps fraktur holes to the verified literals", () => {
    expect(applyStyle("fraktur", "CHIRZ")).toBe("ℭℌℑℜℨ");
  });

  it("maps double-struck holes to the verified literals", () => {
    expect(applyStyle("double-struck", "CHNPQRZ")).toBe("ℂℍℕℙℚℝℤ");
  });

  it("still uses the plain block where there is no hole", () => {
    expect(applyStyle("script", "A")).toBe("\u{1D49C}");
    expect(applyStyle("fraktur", "A")).toBe("\u{1D504}");
    expect(applyStyle("double-struck", "A")).toBe("\u{1D538}");
    expect(applyStyle("double-struck", "0")).toBe("\u{1D7D8}");
  });
});

describe("complete blocks", () => {
  it("maps bold-italic, mono and wide to their verified bases", () => {
    expect(applyStyle("bold-italic", "Aa")).toBe("\u{1D63C}\u{1D656}");
    expect(applyStyle("mono", "Aa0")).toBe("\u{1D670}\u{1D68A}\u{1D7F6}");
    expect(applyStyle("wide", "Aa0")).toBe("Ａａ０");
  });

  it("passes digits through for styles with no digit block", () => {
    for (const key of ["italic", "bold-italic", "script", "fraktur"] as StyleKey[]) {
      expect(applyStyle(key, DIGITS)).toBe(DIGITS);
    }
  });
});

describe("combining-mark styles", () => {
  it("keeps an emoji-ZWJ sequence as one cluster with one mark", () => {
    const out = applyStyle("underline", `a${FAMILY}b`);
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    expect([...segmenter.segment(out)]).toHaveLength(3);
    expect([...out].filter((ch) => ch === UNDERLINE)).toHaveLength(3);
    expect(out).toBe(`a${UNDERLINE}${FAMILY}${UNDERLINE}b${UNDERLINE}`);
  });

  it("does not split the family emoji apart under strike", () => {
    const out = applyStyle("strike", FAMILY);
    expect(out).toBe(FAMILY + STRIKE);
    expect([...out].filter((ch) => ch === STRIKE)).toHaveLength(1);
  });

  it("marks spaces so the rule stays continuous", () => {
    expect(applyStyle("underline", "a b")).toBe(
      `a${UNDERLINE} ${UNDERLINE}b${UNDERLINE}`,
    );
  });

  it("never marks a newline or carriage return", () => {
    expect(applyStyle("underline", "a\nb")).toBe(`a${UNDERLINE}\nb${UNDERLINE}`);
    expect(applyStyle("strike", "a\r\nb")).toBe(`a${STRIKE}\r\nb${STRIKE}`);
    expect(applyStyle("strike", "a\rb")).toBe(`a${STRIKE}\rb${STRIKE}`);
  });

  it("uses U+0332 for underline and U+0336 for strike", () => {
    expect(applyStyle("underline", "x").codePointAt(1)).toBe(0x0332);
    expect(applyStyle("strike", "x").codePointAt(1)).toBe(0x0336);
  });
});

describe("superscript and subscript", () => {
  it("maps every superscript digit, including the Latin-1 outliers 1 2 3", () => {
    expect(applyStyle("super", DIGITS)).toBe(
      "⁰¹²³⁴⁵⁶⁷⁸⁹",
    );
  });

  it("maps every subscript digit from the clean U+2080 run", () => {
    expect(applyStyle("sub", DIGITS)).toBe(
      "₀₁₂₃₄₅₆₇₈₉",
    );
  });

  it("passes the letter q through unchanged — it has no superscript form", () => {
    expect(applyStyle("super", "q")).toBe("q");
    expect(applyStyle("super", "quiz")).toBe("qᵘⁱᶻ");
  });

  it("passes uppercase letters with no superscript form through unchanged", () => {
    for (const ch of "CFQSXYZ") expect(applyStyle("super", ch)).toBe(ch);
  });

  it("passes letters with no subscript form through unchanged", () => {
    for (const ch of "bcdfgqwyz") expect(applyStyle("sub", ch)).toBe(ch);
    expect(applyStyle("sub", UPPERS)).toBe(UPPERS);
  });

  it("maps the superscript letters it does have", () => {
    expect(applyStyle("super", "abn")).toBe("ᵃᵇⁿ");
    expect(applyStyle("sub", "aex")).toBe("ₐₑₓ");
  });
});

describe("pass-through and idempotence", () => {
  it("leaves punctuation and whitespace untouched for codepoint styles", () => {
    for (const key of ALL_KEYS) {
      if (MARK_KEYS.includes(key)) continue;
      expect(applyStyle(key, "!? ,.-\n")).toBe("!? ,.-\n");
    }
  });

  it("is a no-op when applied to text already in that style", () => {
    for (const key of ALL_KEYS) {
      if (MARK_KEYS.includes(key)) continue;
      const once = applyStyle(key, "Style Me 99");
      expect(applyStyle(key, once), `${key} was not idempotent`).toBe(once);
    }
  });

  it("re-states the bold idempotence case explicitly", () => {
    const once = applyStyle("bold", "grip");
    expect(applyStyle("bold", applyStyle("bold", "grip"))).toBe(once);
  });

  it("returns the empty string unchanged for every style", () => {
    for (const key of ALL_KEYS) expect(applyStyle(key, "")).toBe("");
    expect(toPlain("")).toBe("");
  });

  it("passes non-ASCII letters through every codepoint style", () => {
    for (const key of ALL_KEYS) {
      if (MARK_KEYS.includes(key)) continue;
      expect(applyStyle(key, "éü中")).toBe("éü中");
    }
  });
});
