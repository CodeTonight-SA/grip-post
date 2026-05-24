import { describe, it, expect } from "vitest";
import { POLAR_PRO_CHECKOUT_URL, buildCheckoutUrl } from "../src/lib/polar";

describe("POLAR_PRO_CHECKOUT_URL", () => {
  it("points to V>>'s architext1 org + grip-post-pro slug", () => {
    expect(POLAR_PRO_CHECKOUT_URL).toBe(
      "https://polar.sh/architext1/grip-post-pro",
    );
  });
  it("uses https://", () => {
    expect(POLAR_PRO_CHECKOUT_URL.startsWith("https://")).toBe(true);
  });
});

describe("buildCheckoutUrl — default", () => {
  it("returns the bare URL with no params when no opts", () => {
    expect(buildCheckoutUrl()).toBe(POLAR_PRO_CHECKOUT_URL);
  });
});

describe("buildCheckoutUrl — source tracking", () => {
  it("appends ?source=sidepanel", () => {
    const url = buildCheckoutUrl({ source: "sidepanel" });
    expect(url).toContain("source=sidepanel");
  });
  it("URL-encodes special chars in source", () => {
    const url = buildCheckoutUrl({ source: "context menu" });
    expect(url).toContain("source=context+menu");
  });
});

describe("buildCheckoutUrl — email pre-fill", () => {
  it("appends ?customer_email=...", () => {
    const url = buildCheckoutUrl({ email: "v@codetonight.co.za" });
    expect(url).toContain("customer_email=v%40codetonight.co.za");
  });
  it("combines source + email", () => {
    const url = buildCheckoutUrl({
      source: "sidepanel",
      email: "x@y.com",
    });
    expect(url).toContain("source=sidepanel");
    expect(url).toContain("customer_email=x%40y.com");
  });
});

describe("buildCheckoutUrl — adversarial", () => {
  it("two different options produce different URLs", () => {
    const a = buildCheckoutUrl({ source: "sidepanel" });
    const b = buildCheckoutUrl({ source: "context-menu" });
    expect(a).not.toBe(b);
  });
  it("returns a valid URL parseable by URL", () => {
    const url = buildCheckoutUrl({ source: "x" });
    expect(() => new URL(url)).not.toThrow();
  });
});
