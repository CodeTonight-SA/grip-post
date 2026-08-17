import { describe, it, expect } from "vitest";
import {
  toBold,
  toItalic,
  wrapCornerBrackets,
  heavyHorizontal,
  bulletArrow,
  joinHandles,
  diamondTerminate,
  dispatch,
  transformClass,
  isSpliceable,
  TRANSFORMS,
  TRANSFORM_GROUPS,
  type TransformClass,
  type TransformKey,
} from "../src/lib/unicode-toolkit";
import { STYLE_LABELS, type StyleKey } from "../src/lib/styles";
import {
  BULLET_LABELS,
  NUMBER_LABELS,
  type BulletKey,
  type NumberKey,
} from "../src/lib/blocks";
import { DIVIDER_SAMPLES, type DividerKey } from "../src/lib/art";

/** Every key in the table, in table order. */
const ALL_KEYS: readonly TransformKey[] = TRANSFORMS.map((t) => t.key);

/** The ten keys that shipped in v0.1. Their output is frozen. */
const LEGACY_KEYS = [
  "bold",
  "italic",
  "brackets",
  "hr",
  "arrow",
  "handles",
  "diamond",
  "check",
  "strip-tells",
  "ground-check",
] as const;

/** Keys of `table` as its own key type — Object.keys widens to string. */
function keysOf<K extends string>(table: Readonly<Record<K, unknown>>): K[] {
  return Object.keys(table) as K[];
}

describe("toBold", () => {
  it("maps A to U+1D5D4 𝗔", () => expect(toBold("A")).toBe("\u{1D5D4}"));
  it("maps a to U+1D5EE 𝗮", () => expect(toBold("a")).toBe("\u{1D5EE}"));
  it("maps 5 to U+1D7F1 𝟱", () => expect(toBold("5")).toBe("\u{1D7F1}"));
  it("preserves space in 'hello world' — 11 graphemes", () => {
    const result = toBold("hello world");
    expect([...result]).toHaveLength(11);
    expect([...result][5]).toBe(" ");
  });
  it("passes non-ASCII é through unchanged", () => expect(toBold("é")).toBe("é"));
  it("maps full alphabet round-trip: toBold(A) !== A", () =>
    expect(toBold("A")).not.toBe("A"));
});

describe("toItalic", () => {
  it("maps A to U+1D608 𝘈", () => expect(toItalic("A")).toBe("\u{1D608}"));
  it("produces 5 italic codepoints for 'Hello'", () => {
    expect([...toItalic("Hello")]).toHaveLength(5);
  });
  it("maps a to U+1D622 𝘢", () => expect(toItalic("a")).toBe("\u{1D622}"));
});

describe("wrapCornerBrackets", () => {
  it("wraps with exact spaces: ⌜ A ⌟", () =>
    expect(wrapCornerBrackets("A")).toBe("⌜ A ⌟"));
  it("round-trip: original string is preserved inside brackets", () => {
    const s = "test";
    expect(wrapCornerBrackets(s)).toContain(s);
  });
});

describe("heavyHorizontal", () => {
  it("returns 3 ━ chars for width=3", () =>
    expect(heavyHorizontal(3)).toBe("━━━"));
  it("returns '' for width=0", () => expect(heavyHorizontal(0)).toBe(""));
  it("returns '' for width=-1", () => expect(heavyHorizontal(-1)).toBe(""));
  it("clamps 500 to 200 chars", () => {
    expect([...heavyHorizontal(500)]).toHaveLength(200);
  });
  it("each char is U+2501", () => {
    for (const ch of heavyHorizontal(5)) {
      expect(ch.codePointAt(0)).toBe(0x2501);
    }
  });
});

describe("bulletArrow", () => {
  it("returns exact prefix + label", () =>
    expect(bulletArrow("ship it")).toBe("▸  ─→  ship it"));
  it("label is preserved verbatim", () => {
    const label = "my label";
    expect(bulletArrow(label).endsWith(label)).toBe(true);
  });
});

describe("joinHandles", () => {
  it("returns '' for empty array", () => expect(joinHandles([])).toBe(""));
  it("returns single item unchanged", () =>
    expect(joinHandles(["A.com"])).toBe("A.com"));
  it("joins three with U+00B7 and single spaces", () =>
    expect(joinHandles(["A.com", "B.com", "C.com"])).toBe(
      "A.com · B.com · C.com",
    ));
});

describe("diamondTerminate", () => {
  it("appends space + U+25C6", () =>
    expect(diamondTerminate("done")).toBe("done ◆"));
});

describe("dispatch — single source of truth for sidepanel + content script", () => {
  it("routes 'bold' to toBold", () => expect(dispatch("bold", "A")).toBe("\u{1D5D4}"));
  it("routes 'italic' to toItalic", () => expect(dispatch("italic", "A")).toBe("\u{1D608}"));
  it("routes 'brackets' to wrapCornerBrackets", () =>
    expect(dispatch("brackets", "A")).toBe("⌜ A ⌟"));
  it("routes 'hr' with numeric input", () => expect(dispatch("hr", "5")).toBe("━━━━━"));
  it("routes 'hr' with blank input → default 30", () =>
    expect([...dispatch("hr", "")]).toHaveLength(30));
  it("routes 'arrow' to bulletArrow", () =>
    expect(dispatch("arrow", "go")).toBe("▸  ─→  go"));
  it("routes 'handles' splits on comma + trims", () =>
    expect(dispatch("handles", "a , b ,c")).toBe("a · b · c"));
  it("routes 'diamond' to diamondTerminate", () =>
    expect(dispatch("diamond", "done")).toBe("done ◆"));
  it("routes 'check' to formatReport(reportFluff(...))", () => {
    const out = dispatch("check", "Our revolutionary product");
    expect(out).toContain("Verdict: DENY");
    expect(out).toContain("revolutionary");
  });
  it("routes 'check' on clean text → 'Verdict: CLEAN'", () => {
    expect(dispatch("check", "plain text only")).toContain("Verdict: CLEAN");
  });
  it("routes 'strip-tells' to formatStripReport(stripTells(...))", () => {
    const out = dispatch("strip-tells", "🚀 X. Thoughts?");
    // The stripped output is included with the standard header.
    expect(out).toContain("Stripped");
    expect(out).toContain("leading-emoji-hook");
  });
  it("routes 'strip-tells' on clean text → 'No AI tells'", () => {
    expect(dispatch("strip-tells", "Plain text only.")).toContain(
      "No AI tells",
    );
  });
  it("routes 'ground-check' on unsourced claim → verdict REVIEW", () => {
    const out = dispatch("ground-check", "Studies show 80% of teams fail.");
    expect(out).toContain("REVIEW");
    expect(out).toContain("studies show");
  });
  it("routes 'ground-check' on grounded prose → verdict CLEAN", () => {
    const out = dispatch("ground-check", "In my experience this worked.");
    expect(out).toContain("CLEAN");
  });
  it("routing is not a no-op for any key (adversarial)", () => {
    // Multi-handle input so that 'handles' splits + joins (single-item
    // handles correctly passes through unchanged by spec, which would
    // false-positive this no-op detector).
    const input = "a,b";
    const keys = [
      "bold",
      "italic",
      "brackets",
      "hr",
      "arrow",
      "handles",
      "diamond",
      "check",
      "strip-tells",
      "ground-check",
    ] as const;
    for (const k of keys) {
      expect(dispatch(k, input)).not.toBe(input);
    }
  });
});

describe("adversarial — transform independence", () => {
  it("toBold and toItalic produce DIFFERENT output for the same ASCII input", () => {
    expect(toBold("Hello")).not.toBe(toItalic("Hello"));
  });

  it("every transform output differs from input for non-empty ASCII", () => {
    const input = "A";
    expect(toBold(input)).not.toBe(input);
    expect(toItalic(input)).not.toBe(input);
    expect(wrapCornerBrackets(input)).not.toBe(input);
    expect(bulletArrow(input)).not.toBe(input);
    expect(diamondTerminate(input)).not.toBe(input);
  });
});

// ---------------------------------------------------------------------------
// The transform table — the single source of truth the whole UI derives from
// ---------------------------------------------------------------------------

const CLASSES: readonly TransformClass[] = [
  "map",
  "wrap",
  "line",
  "insert",
  "whole",
  "report",
];

describe("TRANSFORMS — table integrity", () => {
  it("declares at least the ten legacy keys plus the new families", () => {
    expect(TRANSFORMS.length).toBeGreaterThanOrEqual(LEGACY_KEYS.length);
  });

  it("every row carries a key, a class, a label and a group", () => {
    for (const row of TRANSFORMS) {
      expect(row.key.length, `key of ${row.key}`).toBeGreaterThan(0);
      expect(CLASSES, `class of ${row.key}`).toContain(row.cls);
      expect(row.label.length, `label of ${row.key}`).toBeGreaterThan(0);
      expect(row.group.length, `group of ${row.key}`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate keys", () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
  });

  it("every hint, where present, is a non-empty string", () => {
    for (const row of TRANSFORMS) {
      if (row.hint !== undefined) {
        expect(row.hint.length, `hint of ${row.key}`).toBeGreaterThan(0);
      }
    }
  });

  it("transformClass agrees with the table for every key", () => {
    for (const row of TRANSFORMS) {
      expect(transformClass(row.key), row.key).toBe(row.cls);
    }
  });

  it("uses every one of the six classes at least once", () => {
    const used = new Set(TRANSFORMS.map((t) => t.cls));
    for (const cls of CLASSES) expect([...used], cls).toContain(cls);
  });

  it("contains every legacy key", () => {
    for (const key of LEGACY_KEYS) expect(ALL_KEYS).toContain(key);
  });

  it("TRANSFORM_GROUPS lists each group exactly once", () => {
    expect(new Set(TRANSFORM_GROUPS).size).toBe(TRANSFORM_GROUPS.length);
  });

  it("TRANSFORM_GROUPS covers every row's group and nothing else", () => {
    expect([...TRANSFORM_GROUPS].sort()).toEqual(
      [...new Set(TRANSFORMS.map((t) => t.group))].sort(),
    );
  });

  it("TRANSFORM_GROUPS preserves first-appearance order", () => {
    const firstSeen = TRANSFORM_GROUPS.map((g) =>
      TRANSFORMS.findIndex((t) => t.group === g),
    );
    expect(firstSeen).toEqual([...firstSeen].sort((a, b) => a - b));
  });
});

// ---------------------------------------------------------------------------
// Coverage — a family gains a key here the moment it gains a member there
// ---------------------------------------------------------------------------

describe("TRANSFORMS — covers every key of the delegated modules", () => {
  const styleKeys = keysOf<StyleKey>(STYLE_LABELS);
  const bulletKeys = keysOf<BulletKey>(BULLET_LABELS);
  const numberKeys = keysOf<NumberKey>(NUMBER_LABELS);
  const dividerKeys = keysOf<DividerKey>(DIVIDER_SAMPLES);

  it("has a key for every style in styles.ts", () => {
    for (const k of styleKeys) expect(ALL_KEYS).toContain(k);
  });

  it("has a bullet- key for every bullet in blocks.ts", () => {
    for (const k of bulletKeys) expect(ALL_KEYS).toContain(`bullet-${k}`);
  });

  it("has a number- key for every numbering in blocks.ts", () => {
    for (const k of numberKeys) expect(ALL_KEYS).toContain(`number-${k}`);
  });

  it("has a divider- key for every divider in art.ts", () => {
    for (const k of dividerKeys) expect(ALL_KEYS).toContain(`divider-${k}`);
  });

  it("declares no bullet-/number-/divider- key that its module does not own", () => {
    const owned: ReadonlyArray<readonly [string, readonly string[]]> = [
      ["bullet-", bulletKeys],
      ["number-", numberKeys],
      ["divider-", dividerKeys],
    ];
    for (const key of ALL_KEYS) {
      for (const [prefix, members] of owned) {
        if (key.startsWith(prefix)) {
          expect(members, key).toContain(key.slice(prefix.length));
        }
      }
    }
  });

  it("labels the style keys exactly as styles.ts labels them", () => {
    for (const k of styleKeys) {
      const row = TRANSFORMS.find((t) => t.key === k);
      expect(row?.label, k).toBe(STYLE_LABELS[k]);
    }
  });

  it("labels the bullet keys exactly as blocks.ts labels them", () => {
    for (const k of bulletKeys) {
      const row = TRANSFORMS.find((t) => t.key === `bullet-${k}`);
      expect(row?.label, k).toBe(BULLET_LABELS[k]);
    }
  });

  it("labels the numbering keys exactly as blocks.ts labels them", () => {
    for (const k of numberKeys) {
      const row = TRANSFORMS.find((t) => t.key === `number-${k}`);
      expect(row?.label, k).toBe(NUMBER_LABELS[k]);
    }
  });
});

// ---------------------------------------------------------------------------
// Totality — every key answers, whatever you hand it
// ---------------------------------------------------------------------------

const TOTALITY_INPUTS: ReadonlyArray<readonly [string, string]> = [
  ["the empty string", ""],
  ["a single letter", "a"],
  ["a multi-line post", "First line.\nSecond line.\n\nFourth line."],
  ["an emoji string", "🚀 é 👩‍💻"],
];

describe("dispatch — total over the table", () => {
  for (const [name, input] of TOTALITY_INPUTS) {
    it(`returns a string for every key on ${name}`, () => {
      for (const key of ALL_KEYS) {
        expect(() => dispatch(key, input), key).not.toThrow();
        expect(typeof dispatch(key, input), key).toBe("string");
      }
    });
  }

  it("is deterministic — the same key and input give the same string", () => {
    const input = "Shipped the patch. 3 tests, 0 failures.";
    for (const key of ALL_KEYS) {
      expect(dispatch(key, input), key).toBe(dispatch(key, input));
    }
  });
});

// ---------------------------------------------------------------------------
// The legacy contract — these ten outputs are frozen, byte for byte
// ---------------------------------------------------------------------------

describe("dispatch — legacy keys are byte-identical to v0.1", () => {
  const FROZEN: ReadonlyArray<readonly [TransformKey, string, string]> = [
    ["bold", "Hello 123", "\u{1D5DB}\u{1D5F2}\u{1D5F9}\u{1D5F9}\u{1D5FC} \u{1D7ED}\u{1D7EE}\u{1D7EF}"],
    ["italic", "Hello 123", "\u{1D60F}\u{1D626}\u{1D62D}\u{1D62D}\u{1D630} 123"],
    ["brackets", "note", "⌜ note ⌟"],
    ["hr", "5", "━━━━━"],
    ["hr", "", "━".repeat(30)],
    ["arrow", "ship it", "▸  ─→  ship it"],
    ["handles", "a , b ,c", "a · b · c"],
    ["diamond", "done", "done ◆"],
    [
      "check",
      "Our revolutionary product",
      'Verdict: DENY\nStats: 3 words, 25 chars, 0 em-dashes, 0 emoji.\nBanned phrases (1):\n  - "revolutionary" at offset 4',
    ],
    [
      "strip-tells",
      "🚀 X. Thoughts?",
      'Stripped 2 tell(s):\n  - [leading-emoji-hook] "🚀 " → (removed)\n  - [trailing-call-to-action] " Thoughts?" → (removed)\n\n--- Stripped output ---\nX.',
    ],
    [
      "ground-check",
      "Studies show 80% of teams fail.",
      "Grounding verdict: REVIEW\nClaims to review (2):\n  - [unsourced: 'studies show'] \"Studies show\" at offset 0\n  - [statistic — needs citation] \"80%\" at offset 13\n\nTip: add a source (URL, 'according to X', citation marker) or\nsoften to first-person ('in my experience', 'I've found').",
    ],
  ];

  for (const [key, input, expected] of FROZEN) {
    it(`${key} on ${JSON.stringify(input)} is unchanged`, () => {
      expect(dispatch(key, input)).toBe(expected);
    });
  }

  it("every legacy key still classifies as something the editor can use", () => {
    for (const key of LEGACY_KEYS) {
      expect(CLASSES, key).toContain(transformClass(key));
    }
  });
});

/**
 * The pre-change block arithmetic, frozen here so the delegation of
 * toBold/toItalic to styles.ts stays honest. Copied verbatim from the v0.1
 * implementation; if a base in styles.ts moves, this fails.
 */
function legacyShift(
  s: string,
  blocks: ReadonlyArray<{ base: number; srcBase: number; count: number }>,
): string {
  return [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      for (const b of blocks) {
        if (cp >= b.srcBase && cp < b.srcBase + b.count) {
          return String.fromCodePoint(cp - b.srcBase + b.base);
        }
      }
      return ch;
    })
    .join("");
}

const LEGACY_BOLD_BLOCKS = [
  { base: 0x1d5d4, srcBase: 0x41, count: 26 },
  { base: 0x1d5ee, srcBase: 0x61, count: 26 },
  { base: 0x1d7ec, srcBase: 0x30, count: 10 },
] as const;

const LEGACY_ITALIC_BLOCKS = [
  { base: 0x1d608, srcBase: 0x41, count: 26 },
  { base: 0x1d622, srcBase: 0x61, count: 26 },
] as const;

describe("toBold / toItalic — delegation to styles.ts changed nothing", () => {
  /** Every printable ASCII character, one string per character. */
  const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
    String.fromCodePoint(0x20 + i),
  );

  it("matches the v0.1 arithmetic on every printable ASCII character", () => {
    for (const ch of ASCII) {
      expect(toBold(ch), ch).toBe(legacyShift(ch, LEGACY_BOLD_BLOCKS));
      expect(toItalic(ch), ch).toBe(legacyShift(ch, LEGACY_ITALIC_BLOCKS));
    }
  });

  it("matches the v0.1 arithmetic on awkward strings", () => {
    const cases = [
      "",
      "Hello, World! 123",
      "é",
      "é",
      "🚀 rocket",
      "line1\nline2\r\nline3",
      "\u{1D5D4}already bold",
      "👩‍💻 zwj",
    ];
    for (const s of cases) {
      expect(toBold(s), JSON.stringify(s)).toBe(
        legacyShift(s, LEGACY_BOLD_BLOCKS),
      );
      expect(toItalic(s), JSON.stringify(s)).toBe(
        legacyShift(s, LEGACY_ITALIC_BLOCKS),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The safety property — a report can never be written into the document
// ---------------------------------------------------------------------------

describe("report class — structurally cannot mutate the document", () => {
  const reportKeys = TRANSFORMS.filter((t) => t.cls === "report").map(
    (t) => t.key,
  );
  /** Exactly what the editor is allowed to splice, derived from the table. */
  const spliceable = ALL_KEYS.filter((k) => isSpliceable(k));

  it("there is at least one report key, so this suite can fail", () => {
    expect(reportKeys.length).toBeGreaterThan(0);
  });

  it("no report key appears in the spliceable set", () => {
    for (const key of reportKeys) expect(spliceable, key).not.toContain(key);
  });

  it("every non-report key IS spliceable — the rule is class-based, not a denylist", () => {
    for (const row of TRANSFORMS) {
      expect(isSpliceable(row.key), row.key).toBe(row.cls !== "report");
    }
  });

  it("the two sets partition the table exactly", () => {
    expect(spliceable.length + reportKeys.length).toBe(ALL_KEYS.length);
  });

  it("the four checks are the report keys", () => {
    expect([...reportKeys].sort()).toEqual(
      ["check", "ground-check", "metrics", "strip-tells"].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// The new keys — behaviour, not spelling
// ---------------------------------------------------------------------------

describe("dispatch — style keys", () => {
  it("bold-italic maps A to U+1D63C 𝘼", () =>
    expect(dispatch("bold-italic", "A")).toBe("\u{1D63C}"));
  it("mono maps A to U+1D670 𝙰", () =>
    expect(dispatch("mono", "A")).toBe("\u{1D670}"));
  it("wide maps A to U+FF21 Ａ", () =>
    expect(dispatch("wide", "A")).toBe("Ａ"));
  it("underline appends the combining mark U+0332", () =>
    expect(dispatch("underline", "A")).toBe("A̲"));
  it("plain undoes bold — round-trip back to the original ASCII", () =>
    expect(dispatch("plain", dispatch("bold", "Hello 123"))).toBe("Hello 123"));
  it("plain undoes underline", () =>
    expect(dispatch("plain", dispatch("underline", "Hello"))).toBe("Hello"));
  it("plain undoes every map-class style it is the inverse of", () => {
    const styled = keysOf<StyleKey>(STYLE_LABELS);
    for (const k of styled) {
      expect(dispatch("plain", dispatch(k, "Hello")), k).toBe("Hello");
    }
  });
});

describe("dispatch — line keys", () => {
  const two = "one\ntwo";

  it("bullet-dot prefixes every line with U+2022", () =>
    expect(dispatch("bullet-dot", two)).toBe("• one\n• two"));
  it("bullet-check prefixes with U+2713, not the fluff report", () =>
    expect(dispatch("bullet-check", "a")).toBe("✓ a"));
  it("number-circled numbers the lines ① ②", () =>
    expect(dispatch("number-circled", two)).toBe("① one\n② two"));
  it("number-plain numbers the lines 1. 2.", () =>
    expect(dispatch("number-plain", two)).toBe("1. one\n2. two"));
  it("quote draws the U+258F rule and pads the block", () =>
    expect(dispatch("quote", two)).toBe("\n▏ one\n▏ two\n"));
  it("indent uses three U+2007 figure spaces", () =>
    expect(dispatch("indent", "a")).toBe("   a"));

  it("strip-prefix is the inverse of every line marker", () => {
    const lineKeys = TRANSFORMS.filter(
      (t) => t.cls === "line" && t.key !== "strip-prefix",
    ).map((t) => t.key);
    for (const k of lineKeys) {
      expect(dispatch("strip-prefix", dispatch(k, two)), k).toBe(two);
    }
  });
});

describe("dispatch — insert keys", () => {
  it("divider-heavy draws U+2501 at the art module's default width", () =>
    expect(dispatch("divider-heavy", "")).toBe("━".repeat(24)));
  it("divider-heavy takes a width from the input", () =>
    expect(dispatch("divider-heavy", "4")).toBe("━━━━"));
  it("divider-fade walks the ▓▒░ density ramp", () =>
    expect(dispatch("divider-fade", "3")).toBe("▓▒░"));
  it("divider-stars alternates ✦ and ✧", () =>
    expect(dispatch("divider-stars", "4")).toBe("✦✧✦✧"));
  it("progress draws a ten-block bar plus the percentage", () =>
    expect(dispatch("progress", "40")).toBe("████░░░░░░ 40%"));
  it("progress with no number reads as 0%", () =>
    expect(dispatch("progress", "")).toBe("░░░░░░░░░░ 0%"));
  it("sparkline draws one block per number", () =>
    expect(dispatch("sparkline", "1,5,3")).toBe("▁█▅"));
  it("sparkline accepts whitespace separators too", () =>
    expect(dispatch("sparkline", "1 5 3")).toBe("▁█▅"));
  it("sparkline on prose draws nothing rather than guessing", () =>
    expect(dispatch("sparkline", "no numbers here")).toBe(""));
  it("stars renders a score out of five", () =>
    expect(dispatch("stars", "3")).toBe("★★★☆☆"));
  it("stars with no number reads as zero", () =>
    expect(dispatch("stars", "")).toBe("☆☆☆☆☆"));
  it("callout frames monospace text in a light box, padded with U+2007", () =>
    // Padding is FIGURE SPACE, not U+0020 — written as an escape because the
    // two are indistinguishable on screen and only one of them lines up.
    expect(dispatch("callout", "hi")).toBe(
      "\u250C\u2500\u2500\u2500\u2500\u2510\n" +
        "\u2502\u2007\u{1D691}\u{1D692}\u2007\u2502\n" +
        "\u2514\u2500\u2500\u2500\u2500\u2518",
    ));
  it("hr and divider-heavy differ only in their default width", () => {
    expect(dispatch("hr", "7")).toBe(dispatch("divider-heavy", "7"));
    expect(dispatch("hr", "")).not.toBe(dispatch("divider-heavy", ""));
  });
});

describe("dispatch — report keys read the post and answer", () => {
  it("metrics counts what a reader sees, not UTF-16 units", () => {
    const out = dispatch("metrics", dispatch("bold", "Hello"));
    expect(out).toContain("characters");
    expect(out).toContain("5");
    expect(out).toContain("within the 3000 limit");
  });

  it("metrics on an empty post reports zero characters", () =>
    expect(dispatch("metrics", "")).toContain("characters ........ 0"));

  it("a report never returns its input unchanged", () => {
    const post = "We shipped the patch today.";
    for (const row of TRANSFORMS.filter((t) => t.cls === "report")) {
      expect(dispatch(row.key, post), row.key).not.toBe(post);
    }
  });
});
