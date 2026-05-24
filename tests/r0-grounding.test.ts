import { describe, it, expect } from "vitest";
import {
  detectUngroundedClaims,
  reportGrounding,
  formatGroundingReport,
} from "../src/lib/r0-grounding";

describe("detectUngroundedClaims — universal-claim patterns", () => {
  it("flags 'studies show'", () => {
    const flags = detectUngroundedClaims("Studies show that we are all wrong.");
    expect(flags).toHaveLength(1);
    expect(flags[0].label).toContain("studies show");
  });
  it("flags 'research proves'", () => {
    const flags = detectUngroundedClaims("Research proves X.");
    expect(flags[0].label).toContain("research proves");
  });
  it("flags 'data shows'", () => {
    const flags = detectUngroundedClaims("Data shows Y.");
    expect(flags[0].label).toContain("data shows");
  });
  it("flags 'experts agree'", () => {
    const flags = detectUngroundedClaims("Experts agree on this.");
    expect(flags[0].label).toContain("experts agree");
  });
  it("flags 'everyone knows'", () => {
    const flags = detectUngroundedClaims("Everyone knows it.");
    expect(flags[0].label).toContain("everyone knows");
  });
  it("flags 'science has shown'", () => {
    const flags = detectUngroundedClaims("Science has shown the truth.");
    expect(flags[0].label).toContain("science has shown");
  });
  it("flags universal belief claims", () => {
    const flags = detectUngroundedClaims("All experts believe this.");
    expect(flags.some((f) => f.label.includes("universal claim"))).toBe(true);
  });
});

describe("detectUngroundedClaims — statistic flagging", () => {
  it("flags a bare percentage with no source", () => {
    const flags = detectUngroundedClaims("80% of teams fail.");
    expect(flags.some((f) => f.label.includes("statistic"))).toBe(true);
  });
  it("does NOT flag a percentage with a URL nearby (within 80 chars)", () => {
    const flags = detectUngroundedClaims(
      "80% of teams fail per https://example.com/study.",
    );
    expect(flags.find((f) => f.label.includes("statistic"))).toBeUndefined();
  });
  it("does NOT flag a percentage with 'according to' nearby", () => {
    const flags = detectUngroundedClaims(
      "According to Gartner, 80% of orgs struggle.",
    );
    expect(flags.find((f) => f.label.includes("statistic"))).toBeUndefined();
  });
  it("does NOT flag a percentage near a numbered citation", () => {
    const flags = detectUngroundedClaims("60% report this [1].");
    expect(flags.find((f) => f.label.includes("statistic"))).toBeUndefined();
  });
  it("flags percentages far from any citation marker", () => {
    const flags = detectUngroundedClaims(
      "I'll just claim that 95% of all software is broken because vibes.",
    );
    expect(flags.some((f) => f.label.includes("statistic"))).toBe(true);
  });
});

describe("detectUngroundedClaims — clean prose", () => {
  it("returns no flags for first-person grounded prose", () => {
    const flags = detectUngroundedClaims(
      "In my experience working with three legal teams, manual chains of custody broke twice.",
    );
    expect(flags).toHaveLength(0);
  });
  it("returns no flags for an empty string", () => {
    expect(detectUngroundedClaims("")).toHaveLength(0);
  });
});

describe("detectUngroundedClaims — sort order", () => {
  it("returns flags in source order (ascending start offset)", () => {
    const text = "Experts agree that 50% of studies show problems.";
    const flags = detectUngroundedClaims(text);
    const offsets = flags.map((f) => f.start);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });
});

describe("detectUngroundedClaims — adversarial", () => {
  it("two different inputs produce different flag sets", () => {
    const a = detectUngroundedClaims("Studies show X.");
    const b = detectUngroundedClaims("Plain prose.");
    // a has 1 flag, b has 0 — different .length is enough.
    expect(a.length).not.toBe(b.length);
  });
  it("does not flag 'study' (different word)", () => {
    const flags = detectUngroundedClaims("This study cited the data.");
    expect(flags.filter((f) => f.label.includes("studies show"))).toHaveLength(0);
  });
});

describe("reportGrounding — verdict mapping", () => {
  it("clean prose → verdict 'clean'", () => {
    expect(reportGrounding("Plain.").verdict).toBe("clean");
  });
  it("one flag → verdict 'review'", () => {
    expect(reportGrounding("Studies show X.").verdict).toBe("review");
  });
  it("many flags → verdict 'review'", () => {
    const r = reportGrounding(
      "Studies show 80% of experts agree everyone knows it.",
    );
    expect(r.verdict).toBe("review");
    expect(r.flags.length).toBeGreaterThanOrEqual(3);
  });
});

describe("formatGroundingReport", () => {
  it("includes the verdict line", () => {
    const out = formatGroundingReport(reportGrounding("Plain"));
    expect(out).toContain("CLEAN");
  });
  it("lists each flag with its label", () => {
    const out = formatGroundingReport(reportGrounding("Studies show X."));
    expect(out).toContain("studies show");
    expect(out).toContain("Tip");
  });
});
