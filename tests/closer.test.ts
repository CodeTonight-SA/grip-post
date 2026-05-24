import { describe, it, expect } from "vitest";
import {
  rewriteCloser,
  DEFAULT_HAL_ENDPOINT,
  type ClosingIntent,
} from "../src/lib/closer";

describe("DEFAULT_HAL_ENDPOINT", () => {
  it("points to the production HAL endpoint", () => {
    expect(DEFAULT_HAL_ENDPOINT).toBe("https://hal.grip-web.com/api/infer");
  });
});

describe("rewriteCloser — anti-fluff floor (always runs, even pre-licence)", () => {
  it("refuses immediately when the draft contains a banned phrase", async () => {
    const res = await rewriteCloser({
      draft: "Our revolutionary product is here.",
      intent: "tease-product",
      licenceKey: "valid-key",
    });
    expect(res.closer).toBeNull();
    expect(res.reasoning).toContain("revolutionary");
    expect(res.reasoning.toLowerCase()).toContain("refused");
  });
  it("refusal reasoning names the SPECIFIC phrase, not a generic 'fluff detected'", async () => {
    const res = await rewriteCloser({
      draft: "Excited to announce groundbreaking work.",
      intent: "tease-product",
    });
    expect(res.closer).toBeNull();
    // Either banned phrase counts — both are in the BANNED_PHRASES set.
    expect(
      res.reasoning.includes("excited to announce") ||
        res.reasoning.includes("groundbreaking"),
    ).toBe(true);
  });
});

describe("rewriteCloser — licence gate (after anti-fluff passes)", () => {
  it("refuses with a buy-Pro hint when no licence key is supplied", async () => {
    const res = await rewriteCloser({
      draft: "Plain technical update, no fluff.",
      intent: "invite-reply",
    });
    expect(res.closer).toBeNull();
    expect(res.reasoning).toContain("Pro tier");
    expect(res.reasoning).toContain("$9");
  });
});

describe("rewriteCloser — stub honour (v0.1 / v0.2 surface)", () => {
  it("with valid licence + clean draft, returns null closer + a 'scaffolded' reasoning", async () => {
    const res = await rewriteCloser({
      draft: "Tests are green. Shipped v0.0.1.",
      intent: "ask-question",
      licenceKey: "valid-key",
    });
    expect(res.closer).toBeNull();
    expect(res.reasoning).toContain("scaffolded");
    expect(res.reasoning).toContain("v0.3");
    expect(res.reasoning).toContain("ask-question");
  });
});

describe("rewriteCloser — adversarial (refusal is a FEATURE, not a failure)", () => {
  it("for every intent, the stub refuses without throwing", async () => {
    const intents: ClosingIntent[] = [
      "tease-product",
      "invite-reply",
      "thank-person",
      "ask-question",
    ];
    for (const intent of intents) {
      const res = await rewriteCloser({
        draft: "plain",
        intent,
        licenceKey: "valid-key",
      });
      expect(res.closer).toBeNull();
      expect(typeof res.reasoning).toBe("string");
      expect(res.reasoning.length).toBeGreaterThan(0);
    }
  });
  it("response shape is stable: every call returns {closer, reasoning}", async () => {
    const res = await rewriteCloser({
      draft: "test",
      intent: "tease-product",
    });
    expect(res).toHaveProperty("closer");
    expect(res).toHaveProperty("reasoning");
  });
});
