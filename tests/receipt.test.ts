import { describe, it, expect } from "vitest";
import {
  STYLED_GLYPH_LO,
  STYLED_GLYPH_HI,
  countStyledGlyphs,
  gatherReceipt,
  formatReceipt,
  buildReceipt,
  type ReceiptData,
} from "../src/lib/receipt";
import { toBold, toItalic, wrapCornerBrackets, diamondTerminate } from "../src/lib/unicode-toolkit";

const OPTS = { cleanChecks: 7, date: "2026-06-02", version: "0.1.1" };

/** A canonical CLEAN ReceiptData for formatter tests (no aggregation coupling). */
function cleanData(over: Partial<ReceiptData> = {}): ReceiptData {
  return {
    cliches: 0,
    tellsFound: 0,
    unsourced: 0,
    styledGlyphs: 0,
    words: 12,
    chars: 64,
    cleanChecks: 7,
    clean: true,
    date: "2026-06-02",
    version: "0.1.1",
    ...over,
  };
}

describe("countStyledGlyphs", () => {
  it("is 0 for plain ASCII", () => {
    expect(countStyledGlyphs("We shipped the patch today.")).toBe(0);
  });
  it("counts Math-Sans-Bold letters (toBold)", () => {
    expect(countStyledGlyphs(toBold("hi"))).toBe(2);
  });
  it("counts Math-Sans-Italic letters (toItalic)", () => {
    expect(countStyledGlyphs(toItalic("abc"))).toBe(3);
  });
  it("counts bold digits (the 0x1D7EC block is in range)", () => {
    expect(countStyledGlyphs(toBold("90"))).toBe(2);
  });
  it("does NOT count decorative wrappers (⌜ ⌟ ◆) — they read acceptably", () => {
    expect(countStyledGlyphs(wrapCornerBrackets("hi"))).toBe(0);
    expect(countStyledGlyphs(diamondTerminate("done"))).toBe(0);
  });
  it("the styled range bounds are the Mathematical Alphanumeric block", () => {
    expect(STYLED_GLYPH_LO).toBe(0x1d400);
    expect(STYLED_GLYPH_HI).toBe(0x1d7ff);
  });
});

describe("gatherReceipt", () => {
  it("a genuinely clean post yields all-zero, clean=true", () => {
    const d = gatherReceipt({ text: "We shipped the patch today. Tests are green.", ...OPTS });
    expect(d.cliches).toBe(0);
    expect(d.tellsFound).toBe(0);
    expect(d.unsourced).toBe(0);
    expect(d.clean).toBe(true);
    expect(d.words).toBeGreaterThan(0);
    expect(d.chars).toBeGreaterThan(0);
  });
  it("aggregates clichés (anti-fluff) and unsourced claims (r0) — clean=false", () => {
    const d = gatherReceipt({
      text: "Our revolutionary product. Studies show 50% growth.",
      ...OPTS,
    });
    expect(d.cliches).toBeGreaterThanOrEqual(1); // "revolutionary"
    expect(d.unsourced).toBeGreaterThanOrEqual(2); // "studies show" + "50%"
    expect(d.clean).toBe(false);
  });
  it("counts remaining AI tells (strip-tells) toward not-clean", () => {
    const d = gatherReceipt({ text: "Shipping is hard. Thoughts?", ...OPTS });
    expect(d.tellsFound).toBeGreaterThanOrEqual(1); // trailing CTA
    expect(d.clean).toBe(false);
  });
  it("passes the running tally and stamp through verbatim", () => {
    const d = gatherReceipt({ text: "plain", cleanChecks: 42, date: "2026-01-01", version: "9.9.9" });
    expect(d.cleanChecks).toBe(42);
    expect(d.date).toBe("2026-01-01");
    expect(d.version).toBe("9.9.9");
  });
});

describe("formatReceipt — clean vs needs-work header", () => {
  it("clean data renders CLEAN RECEIPT and not NEEDS WORK", () => {
    const out = formatReceipt(cleanData());
    expect(out).toContain("CLEAN RECEIPT");
    expect(out).not.toContain("NEEDS WORK");
  });
  it("dirty data renders NEEDS WORK and a fix line, not CLEAN RECEIPT", () => {
    const out = formatReceipt(cleanData({ cliches: 2, clean: false }));
    expect(out).toContain("NEEDS WORK");
    expect(out).not.toContain("CLEAN RECEIPT");
    expect(out).toContain("→ fix 2 clichés");
  });
  it("fix summary pluralises correctly (1 vs many)", () => {
    expect(formatReceipt(cleanData({ cliches: 1, clean: false }))).toContain("1 cliché");
    expect(formatReceipt(cleanData({ unsourced: 3, clean: false }))).toContain("3 unsourced claims");
  });
});

describe("formatReceipt — a11y honesty note (both directions)", () => {
  it("present when styled glyphs > 0", () => {
    expect(formatReceipt(cleanData({ styledGlyphs: 6 }))).toContain("screen readers");
  });
  it("absent when there are no styled glyphs", () => {
    expect(formatReceipt(cleanData({ styledGlyphs: 0 }))).not.toContain("screen readers");
  });
});

describe("formatReceipt — local-only + tally + stamp", () => {
  it("always asserts nothing left the device", () => {
    expect(formatReceipt(cleanData())).toContain("nothing left your device");
  });
  it("renders the running tally and reflects its value (Goodhart)", () => {
    expect(formatReceipt(cleanData({ cleanChecks: 7 }))).toContain("fluff-free check #7");
    expect(formatReceipt(cleanData({ cleanChecks: 8 }))).toContain("#8");
    // the two outputs must differ — the field is load-bearing, not cosmetic
    expect(formatReceipt(cleanData({ cleanChecks: 7 }))).not.toBe(
      formatReceipt(cleanData({ cleanChecks: 8 })),
    );
  });
  it("stamps the exact date · version footer", () => {
    expect(formatReceipt(cleanData())).toContain("2026-06-02 · v0.1.1");
  });
  it("a non-clean receipt shows the standing total, not a clean '#N'", () => {
    const out = formatReceipt(cleanData({ cliches: 1, clean: false }));
    expect(out).toContain("7 fluff-free so far");
    expect(out).not.toContain("fluff-free check #7");
  });
});

describe("buildReceipt — end to end", () => {
  it("a clean ASCII post: CLEAN RECEIPT, no a11y note", () => {
    const out = buildReceipt({ text: "We shipped the patch today. Tests are green.", ...OPTS });
    expect(out).toContain("CLEAN RECEIPT");
    expect(out).not.toContain("screen readers");
    expect(out).toContain("2026-06-02 · v0.1.1");
  });
  it("a clean but bold-styled post stays clean AND surfaces the a11y note", () => {
    const out = buildReceipt({ text: toBold("We shipped the patch today"), ...OPTS });
    expect(out).toContain("CLEAN RECEIPT"); // styling does not change banned-phrase matching
    expect(out).toContain("screen readers");
  });
  it("Goodhart guard: a clean post and a sloppy post never render the same receipt", () => {
    const clean = buildReceipt({ text: "We shipped the patch today.", ...OPTS });
    const slop = buildReceipt({
      text: "Thrilled to announce our revolutionary, game-changing solution.",
      ...OPTS,
    });
    expect(clean).not.toBe(slop);
    expect(slop).toContain("NEEDS WORK");
  });
});
