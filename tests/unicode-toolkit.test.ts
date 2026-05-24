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
} from "../src/lib/unicode-toolkit";

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
