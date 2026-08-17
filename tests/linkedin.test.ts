import { describe, it, expect } from "vitest";
import {
  POST_CHAR_LIMIT,
  FOLD_CHARS_APPROX,
  STYLED_RANGES,
  STYLED_SEVERITY,
  isStyledCodepoint,
  countStyledChars,
  styledRangesPresent,
  countGraphemes,
  firstLine,
  measurePost,
  accessibilityWarning,
  formatMetrics,
  type PostMetrics,
} from "../src/lib/linkedin";
import { toBold, toItalic } from "../src/lib/unicode-toolkit";

/** A plain-ASCII post of a given grapheme length — no styling anywhere. */
const plain = (n: number): string => "a".repeat(n);

/** Canonical metrics for formatter tests, decoupled from measurePost. */
function metrics(over: Partial<PostMetrics> = {}): PostMetrics {
  return {
    chars: 64,
    styledChars: 0,
    lines: 3,
    overLimit: false,
    beyondFold: false,
    ...over,
  };
}

describe("published limits — sourced, never invented", () => {
  it("POST_CHAR_LIMIT is LinkedIn's documented 3,000", () => {
    expect(POST_CHAR_LIMIT).toBe(3000);
  });
  it("FOLD_CHARS_APPROX takes the conservative end of a disagreeing set", () => {
    expect(FOLD_CHARS_APPROX).toBe(140);
    // The published estimates run 140 (mobile) to ~250 (one desktop measure).
    // Taking anything above the smallest would let a post pass the check and
    // still be folded on a phone, so the value must stay at the low end.
    expect(FOLD_CHARS_APPROX).toBeLessThan(210);
  });
  it("the fold sits well inside the hard limit", () => {
    expect(FOLD_CHARS_APPROX).toBeLessThan(POST_CHAR_LIMIT);
  });
});

describe("styled ranges — verified against the live runtime", () => {
  it("detects a Math-Sans-Bold capital (U+1D5D4)", () => {
    expect(String.fromCodePoint(0x1d5d4)).toBe("𝗔");
    expect(isStyledCodepoint(0x1d5d4)).toBe(true);
    expect(countStyledChars("𝗔")).toBe(1);
  });
  it("detects a combining underline (U+0332) on an ordinary letter", () => {
    expect("a̲").toBe("a̲");
    expect(isStyledCodepoint(0x0332)).toBe(true);
    expect(countStyledChars("a̲")).toBe(1); // the mark, not the base 'a'
  });
  it("detects a circled letter (U+24D0)", () => {
    expect(String.fromCodePoint(0x24d0)).toBe("ⓐ");
    expect(countStyledChars("ⓐ")).toBe(1);
  });
  it("detects a fullwidth letter (U+FF41)", () => {
    expect(String.fromCodePoint(0xff41)).toBe("ａ");
    expect(countStyledChars("ａ")).toBe(1);
  });
  it("plain ASCII is never styled", () => {
    expect(countStyledChars("We shipped the patch today. 42 tests green.")).toBe(0);
    expect(isStyledCodepoint("A".codePointAt(0) ?? 0)).toBe(false);
    expect(isStyledCodepoint("z".codePointAt(0) ?? 0)).toBe(false);
    expect(isStyledCodepoint("7".codePointAt(0) ?? 0)).toBe(false);
  });
  it("every declared range is inclusive at both ends and exclusive outside", () => {
    for (const r of STYLED_RANGES) {
      expect(isStyledCodepoint(r.lo)).toBe(true);
      expect(isStyledCodepoint(r.hi)).toBe(true);
      expect(isStyledCodepoint(r.lo - 1)).toBe(false);
      expect(isStyledCodepoint(r.hi + 1)).toBe(false);
    }
  });
  it("names the blocks actually present, and only those", () => {
    expect(styledRangesPresent(toBold("hi"))).toEqual(["mathematical alphanumeric"]);
    expect(styledRangesPresent("a̲")).toEqual(["combining marks"]);
    expect(styledRangesPresent("plain text")).toEqual([]);
    expect(styledRangesPresent(toBold("hi") + "a̲")).toEqual([
      "mathematical alphanumeric",
      "combining marks",
    ]);
  });
});

describe("countGraphemes — the reason this module exists", () => {
  it("styled text: graphemes are HALF the UTF-16 length, not equal to it", () => {
    const bold = toBold("hello");
    expect(bold.length).toBe(10); // UTF-16 units — every letter is a surrogate pair
    expect(countGraphemes(bold)).toBe(5); // what a reader actually sees
    expect(countGraphemes(bold)).not.toBe(bold.length);
  });
  it("plain ASCII: graphemes and UTF-16 length agree", () => {
    expect(countGraphemes("hello")).toBe(5);
    expect(countGraphemes("hello")).toBe("hello".length);
  });
  it("a combining mark is one grapheme but two UTF-16 units", () => {
    expect(countGraphemes("a̲")).toBe(1);
    expect("a̲".length).toBe(2);
  });
  it("empty string is zero", () => {
    expect(countGraphemes("")).toBe(0);
  });
  it("italic text diverges from .length the same way bold does", () => {
    const it_ = toItalic("abc");
    expect(countGraphemes(it_)).toBe(3);
    expect(it_.length).toBe(6);
  });
});

describe("measurePost", () => {
  it("a bolded post is measured at its true length, not double", () => {
    const m = measurePost(toBold(plain(1600)));
    expect(m.chars).toBe(1600);
    expect(m.overLimit).toBe(false); // .length would have said 3200 and lied
    expect(m.styledChars).toBe(1600);
  });
  it("counts lines, and an empty post is zero lines", () => {
    expect(measurePost("one").lines).toBe(1);
    expect(measurePost("one\ntwo\nthree").lines).toBe(3);
    expect(measurePost("trailing\n").lines).toBe(2);
    expect(measurePost("").lines).toBe(0);
  });
  it("an empty post measures zero everywhere and trips nothing", () => {
    expect(measurePost("")).toEqual({
      chars: 0,
      styledChars: 0,
      lines: 0,
      overLimit: false,
      beyondFold: false,
    });
  });
});

describe("thresholds flip exactly at their boundary", () => {
  it("overLimit is false AT the limit and true one character past it", () => {
    expect(measurePost(plain(POST_CHAR_LIMIT - 1)).overLimit).toBe(false);
    expect(measurePost(plain(POST_CHAR_LIMIT)).overLimit).toBe(false);
    expect(measurePost(plain(POST_CHAR_LIMIT + 1)).overLimit).toBe(true);
  });
  it("beyondFold is false AT the fold and true one character past it", () => {
    expect(measurePost(plain(FOLD_CHARS_APPROX - 1)).beyondFold).toBe(false);
    expect(measurePost(plain(FOLD_CHARS_APPROX)).beyondFold).toBe(false);
    expect(measurePost(plain(FOLD_CHARS_APPROX + 1)).beyondFold).toBe(true);
  });
  it("the limit is measured in graphemes: a bolded post at the limit is not over", () => {
    // .length here is 6000; only grapheme counting keeps this honest.
    expect(measurePost(toBold(plain(POST_CHAR_LIMIT))).overLimit).toBe(false);
    expect(measurePost(toBold(plain(POST_CHAR_LIMIT + 1))).overLimit).toBe(true);
  });
});

describe("accessibilityWarning — fires on styling, silent otherwise", () => {
  it("is EMPTY for a plain-ASCII post (a warning that always fires is noise)", () => {
    expect(accessibilityWarning("We shipped the patch today. Tests are green.")).toBe("");
  });
  it("is EMPTY for an empty post", () => {
    expect(accessibilityWarning("")).toBe("");
  });
  it("is EMPTY for plain text carrying punctuation, digits and an em-dash", () => {
    expect(accessibilityWarning("Shipped v2 — 42 tests, 0 failures (finally).")).toBe("");
  });
  it("fires as soon as any styled character is present", () => {
    const out = accessibilityWarning("we shipped " + toBold("fast") + " this week");
    expect(out).not.toBe("");
    expect(out).toContain("Screen readers");
  });
  it("fires for the combining-underline trick too, not just bold", () => {
    expect(accessibilityWarning("a̲ plain tail here")).toContain("Screen readers");
  });
});

describe("accessibilityWarning — severity scales with styled proportion", () => {
  // Ratios are exact by construction: styled letters over total graphemes.
  it("below the moderate threshold: framed as a defensible trade", () => {
    const out = accessibilityWarning(toBold("a") + "bcdef"); // 1/6 ≈ 0.167
    expect(out).toContain("reasonable trade");
    expect(out).not.toContain("effectively unreadable");
  });
  it("AT the moderate threshold: escalates off the light wording", () => {
    const out = accessibilityWarning(toBold("a") + "bcde"); // 1/5 = 0.20
    expect(out).toContain("large part");
    expect(out).not.toContain("reasonable trade");
    expect(out).not.toContain("effectively unreadable");
  });
  it("AT the heavy threshold: says the post is unreadable to a screen reader", () => {
    const out = accessibilityWarning(toBold("abc") + "de"); // 3/5 = 0.60
    expect(out).toContain("effectively unreadable");
    expect(out).not.toContain("reasonable trade");
  });
  it("a wholly bolded post is heavy", () => {
    const out = accessibilityWarning(toBold("we shipped the patch today"));
    expect(out).toContain("effectively unreadable");
  });
  it("the three registers are genuinely different text", () => {
    const light = accessibilityWarning(toBold("a") + "bcdef");
    const moderate = accessibilityWarning(toBold("ab") + "cde"); // 2/5 = 0.40
    const heavy = accessibilityWarning(toBold("abcd") + "e"); // 4/5 = 0.80
    expect(light).not.toBe(moderate);
    expect(moderate).not.toBe(heavy);
    expect(light).not.toBe(heavy);
  });
  it("the light register reports the real counts, not a rounded percentage", () => {
    const out = accessibilityWarning(toBold("ab") + plain(30)); // 2 of 32
    expect(out).toContain("2 of 32 characters");
  });
  it("severity thresholds are ordered and inside (0,1)", () => {
    expect(STYLED_SEVERITY.moderate).toBeGreaterThan(0);
    expect(STYLED_SEVERITY.moderate).toBeLessThan(STYLED_SEVERITY.heavy);
    expect(STYLED_SEVERITY.heavy).toBeLessThan(1);
  });
});

describe("accessibilityWarning — the search caveat is first-line only", () => {
  it("fires when the FIRST line carries styling", () => {
    const out = accessibilityWarning(toBold("Shipping") + " is hard\nplain second line");
    expect(out).toContain("Search");
    expect(out).toContain("first line");
  });
  it("does NOT fire when only a later line carries styling", () => {
    const out = accessibilityWarning("Shipping is hard\nwe went " + toBold("fast"));
    expect(out).not.toContain("Search:");
    // ...but the other two warnings still stand, because styling is still present
    expect(out).toContain("Screen readers");
    expect(out).toContain("Rendering");
  });
  it("a single-line styled post counts as first-line styling", () => {
    expect(accessibilityWarning(toBold("Shipping") + " is hard")).toContain("Search");
  });
  it("firstLine stops at the first newline", () => {
    expect(firstLine("one\ntwo\nthree")).toBe("one");
    expect(firstLine("no newline")).toBe("no newline");
    expect(firstLine("")).toBe("");
  });
});

describe("accessibilityWarning — the rendering caveat", () => {
  it("mentions tofu boxes once, and names the blocks in play", () => {
    const out = accessibilityWarning(toBold("hi") + " " + plain(40));
    const occurrences = out.split("Rendering:").length - 1;
    expect(occurrences).toBe(1);
    expect(out).toContain("empty boxes");
    expect(out).toContain("mathematical alphanumeric");
  });
  it("names the combining-mark block when that is what was used", () => {
    expect(accessibilityWarning("a̲" + plain(40))).toContain("combining marks");
  });
});

describe("formatMetrics", () => {
  it("renders the three counts as dot-leader rows", () => {
    const out = formatMetrics(metrics({ chars: 148, styledChars: 12, lines: 4 }));
    expect(out).toContain("post metrics");
    expect(out).toMatch(/characters \.+ 148/);
    expect(out).toMatch(/styled \.+ 12/);
    expect(out).toMatch(/lines \.+ 4/);
  });
  it("states the limit verdict in both directions", () => {
    expect(formatMetrics(metrics({ overLimit: false }))).toContain(`within the ${POST_CHAR_LIMIT}`);
    expect(formatMetrics(metrics({ overLimit: true }))).toContain(`over the ${POST_CHAR_LIMIT}`);
  });
  it("states the fold verdict in both directions", () => {
    expect(formatMetrics(metrics({ beyondFold: false }))).toContain("before the ~140");
    expect(formatMetrics(metrics({ beyondFold: true }))).toContain("past the ~140");
  });
  it("labels the fold approximate and the hard limit not", () => {
    const out = formatMetrics(metrics());
    expect(out).toContain("(approx)");
    expect(out).not.toContain(`${POST_CHAR_LIMIT} (approx)`);
  });
  it("Goodhart guard: different metrics never render the same block", () => {
    expect(formatMetrics(metrics({ chars: 100 }))).not.toBe(formatMetrics(metrics({ chars: 101 })));
    expect(formatMetrics(metrics({ styledChars: 0 }))).not.toBe(
      formatMetrics(metrics({ styledChars: 1 })),
    );
    expect(formatMetrics(metrics({ overLimit: false }))).not.toBe(
      formatMetrics(metrics({ overLimit: true })),
    );
    expect(formatMetrics(metrics({ beyondFold: false }))).not.toBe(
      formatMetrics(metrics({ beyondFold: true })),
    );
  });
  it("the dot-leader rows align: every count row is exactly the rule width", () => {
    const lines = formatMetrics(metrics({ chars: 2, styledChars: 200000, lines: 17 })).split("\n");
    const rule = lines.find((l) => l.includes("─")) ?? "";
    const rows = lines.filter((l) => l.includes(".."));
    expect(rows).toHaveLength(3);
    // Wildly different value widths must still land in the same column, which
    // is the only thing the dot leader is for.
    for (const r of rows) expect([...r].length).toBe([...rule].length);
  });
});

describe("end to end — the honest bill for a real draft", () => {
  it("a plain draft: metrics render, warning stays silent", () => {
    const post = "We shipped the retry fix today.\nIt cut timeouts from 40 a day to 2.";
    const m = measurePost(post);
    expect(m.styledChars).toBe(0);
    expect(m.lines).toBe(2);
    expect(accessibilityWarning(post)).toBe("");
    expect(formatMetrics(m)).toContain("within the 3000 limit");
  });
  it("a bolded hook: measured honestly and billed honestly", () => {
    const post = toBold("We shipped the retry fix today.") + "\nTimeouts fell from 40 a day to 2.";
    const m = measurePost(post);
    // 25 letters in the hook became astral pairs. UTF-16 length over-counts
    // each by one; grapheme counting is the only measure that stays true.
    expect(m.styledChars).toBe(25);
    expect(m.chars).toBe(65);
    expect(post.length).toBe(65 + 25);
    expect(m.chars).toBe(post.length - m.styledChars);
    const warn = accessibilityWarning(post);
    expect(warn).toContain("Screen readers");
    expect(warn).toContain("Search"); // the hook is the styled line
    expect(warn).toContain("Rendering");
  });
});
