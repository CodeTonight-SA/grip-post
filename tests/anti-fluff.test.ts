import { describe, it, expect } from "vitest";
import {
  BANNED_PHRASES,
  DENSITY_THRESHOLDS,
  detectPhrases,
  countEmDashes,
  countEmojis,
  countWords,
  reportFluff,
  formatReport,
} from "../src/lib/anti-fluff";

describe("BANNED_PHRASES", () => {
  it("contains at least 20 entries (KISS v1 floor)", () => {
    expect(BANNED_PHRASES.length).toBeGreaterThanOrEqual(20);
  });
  it("every entry triggers a match against itself", () => {
    for (const phrase of BANNED_PHRASES) {
      expect(detectPhrases(phrase).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("detectPhrases", () => {
  it("flags 'revolutionary' anywhere in the text", () => {
    const matches = detectPhrases("Our revolutionary product");
    expect(matches).toHaveLength(1);
    expect(matches[0].phrase).toBe("revolutionary");
    expect(matches[0].start).toBe(4);
    expect(matches[0].end).toBe(17);
  });
  it("is case-insensitive", () => {
    expect(detectPhrases("REVOLUTIONARY")).toHaveLength(1);
    expect(detectPhrases("Game-Changing")).toHaveLength(1);
  });
  it("respects word boundaries — 'delve' does not match 'delved'", () => {
    // "delve into" is the banned phrase; "delved" should NOT trip "delve" alone.
    const matches = detectPhrases("She delved into the report");
    expect(matches).toHaveLength(0);
  });
  it("matches multi-word phrases with intervening whitespace", () => {
    expect(detectPhrases("Let's unlock the power of AI").length).toBeGreaterThanOrEqual(1);
  });
  it("returns matches sorted by start offset", () => {
    const text = "thrilled to announce a revolutionary, game-changing innovation";
    const matches = detectPhrases(text);
    expect(matches.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].start).toBeGreaterThanOrEqual(matches[i - 1].start);
    }
  });
  it("returns empty array for clean text", () => {
    expect(detectPhrases("We shipped the patch. Tests are green.")).toEqual([]);
  });
});

describe("countEmDashes", () => {
  it("counts U+2014 only — hyphen-minus does not count", () => {
    expect(countEmDashes("a — b — c - d")).toBe(2);
  });
  it("returns 0 for empty string", () => expect(countEmDashes("")).toBe(0));
});

describe("countEmojis", () => {
  it("counts SMP pictographs (U+1F600 grin)", () => {
    expect(countEmojis("hello 😀 world")).toBe(1);
  });
  it("counts dingbats (U+2728 sparkle)", () => {
    expect(countEmojis("ship it ✨")).toBe(1);
  });
  it("returns 0 for pure ASCII", () => {
    expect(countEmojis("plain text only")).toBe(0);
  });
});

describe("countWords", () => {
  it("0 for empty / whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("splits on whitespace", () => {
    expect(countWords("hello world foo")).toBe(3);
  });
});

describe("reportFluff verdict", () => {
  it("returns 'clean' for fluff-free text", () => {
    expect(reportFluff("We shipped the patch.").verdict).toBe("clean");
  });
  it("returns 'deny' when any banned phrase appears", () => {
    expect(reportFluff("Our revolutionary product").verdict).toBe("deny");
  });
  it("returns 'warn' for emoji density breach without banned phrase", () => {
    // 3 emoji in ~10 chars = 30%, well over 5% threshold
    expect(reportFluff("hi😀😀😀").verdict).toBe("warn");
  });
  it("returns 'warn' for em-dash density breach", () => {
    // many em-dashes per word
    expect(reportFluff("a — b — c — d — e — f").verdict).toBe("warn");
  });
  it("'deny' takes precedence over density warns", () => {
    expect(reportFluff("revolutionary — — — — — — 😀😀😀").verdict).toBe("deny");
  });
});

describe("reportFluff fields", () => {
  it("exposes match list + density ratios", () => {
    const report = reportFluff("Our revolutionary product is groundbreaking.");
    expect(report.matches.length).toBeGreaterThanOrEqual(2);
    expect(report.wordCount).toBe(5);
    expect(report.emDashRatio).toBe(0);
  });
});

describe("formatReport", () => {
  it("renders verdict + stats + matches in plain text", () => {
    const text = "Our revolutionary product";
    const formatted = formatReport(reportFluff(text));
    expect(formatted).toContain("Verdict: DENY");
    expect(formatted).toContain("revolutionary");
    expect(formatted).toContain("words");
  });
  it("clean report has 'No banned phrases.' line", () => {
    expect(formatReport(reportFluff("plain text"))).toContain("No banned phrases.");
  });
});

describe("DENSITY_THRESHOLDS sanity", () => {
  it("thresholds are positive, non-zero, and bounded", () => {
    expect(DENSITY_THRESHOLDS.emDashRatioWarn).toBeGreaterThan(0);
    expect(DENSITY_THRESHOLDS.emojiRatioWarn).toBeGreaterThan(0);
    expect(DENSITY_THRESHOLDS.emDashRatioWarn).toBeLessThan(1);
    expect(DENSITY_THRESHOLDS.emojiRatioWarn).toBeLessThan(1);
  });
});

describe("adversarial — anti-fluff catches representative LinkedIn slop", () => {
  it("flags a paradigmatic AI-LinkedIn post", () => {
    const slop =
      "Thrilled to announce our revolutionary, next-gen, game-changing " +
      "solution that will delve into the paradigm shift and unlock the " +
      "power of synergy — at the end of the day, as a thought leader, " +
      "this is groundbreaking.";
    const report = reportFluff(slop);
    expect(report.verdict).toBe("deny");
    expect(report.matches.length).toBeGreaterThanOrEqual(8);
  });
  it("passes a clean technical announcement", () => {
    const clean =
      "We shipped v0.0.1 today. Seven Unicode transforms, an anti-fluff " +
      "gate, and a side panel that pastes results into LinkedIn. Repo at " +
      "github.com/CodeTonight-SA/grip-post.";
    expect(reportFluff(clean).verdict).toBe("clean");
  });
});
