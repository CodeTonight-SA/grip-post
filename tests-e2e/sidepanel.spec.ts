// grip-post side panel — E2E smoke tests against the BUILT dist artefact.
//
// These run against `dist/src/sidepanel.html` (the post-vite output), not
// `src/sidepanel.html` — so they catch build-pipeline regressions that
// the unit suite cannot see (e.g. import-path rewrites, asset chunking,
// missing script bundle).
//
// Mutation-anchored: each test asserts a specific transform output, so a
// regression that swaps the dispatch table or breaks the click handler
// fails the suite. Adversarial: a "no-op detector" verifies that clicking
// each button materially changes the output element.

import { test, expect } from "@playwright/test";

// The sidepanel HTML lives at /src/sidepanel.html under the vite preview
// server (configured in playwright.config.ts to serve dist/ at :4173).
// Using a relative path lets Playwright's `baseURL` resolve correctly.
const SIDEPANEL_URL = "/src/sidepanel.html";

async function setInput(page: import("@playwright/test").Page, text: string) {
  await page.locator("#input").fill(text);
}

async function output(page: import("@playwright/test").Page): Promise<string> {
  return (await page.locator("#output").textContent()) ?? "";
}

test.describe("sidepanel loads", () => {
  test("the side panel HTML renders the brand + buttons", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await expect(page.locator("h1")).toHaveText("grip-post");
    // Every transform button is present.
    for (const key of [
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
    ]) {
      await expect(
        page.locator(`button[data-transform="${key}"]`),
      ).toBeVisible();
    }
    // Every history action is present.
    for (const action of ["save-draft", "view-history", "clear-history"]) {
      await expect(
        page.locator(`button[data-action="${action}"]`),
      ).toBeVisible();
    }
  });
});

test.describe("transform dispatch — happy path", () => {
  test("bold transforms ASCII to math sans-serif bold", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "A");
    await page.locator('button[data-transform="bold"]').click();
    // U+1D5D4 is math sans-serif bold A.
    expect(await output(page)).toBe("\u{1D5D4}");
  });

  test("italic transforms ASCII to math sans-serif italic", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "A");
    await page.locator('button[data-transform="italic"]').click();
    expect(await output(page)).toBe("\u{1D608}");
  });

  test("brackets wraps text in corner brackets", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "X");
    await page.locator('button[data-transform="brackets"]').click();
    expect(await output(page)).toBe("⌜ X ⌟");
  });
});

test.describe("anti-fluff + R0 + strip-tells routes", () => {
  test("check fires anti-fluff and reports DENY on banned phrase", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "Our revolutionary product is here.");
    await page.locator('button[data-transform="check"]').click();
    const out = await output(page);
    expect(out).toContain("Verdict: DENY");
    expect(out).toContain("revolutionary");
  });

  test("strip-tells removes leading hook emoji + reports change", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "🚀 Excited to share!");
    await page.locator('button[data-transform="strip-tells"]').click();
    const out = await output(page);
    expect(out).toContain("leading-emoji-hook");
    expect(out).toContain("Excited to share!");
  });

  test("ground-check flags unsourced 'studies show'", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "Studies show 95% of teams fail.");
    await page.locator('button[data-transform="ground-check"]').click();
    const out = await output(page);
    expect(out).toContain("REVIEW");
    expect(out).toContain("studies show");
  });

  test("ground-check on first-person prose returns CLEAN", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "In my experience, this worked.");
    await page.locator('button[data-transform="ground-check"]').click();
    expect(await output(page)).toContain("CLEAN");
  });
});

test.describe("draft history actions", () => {
  test("save → view round-trip surfaces the saved text", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "draft body to remember");
    await page.locator('button[data-action="save-draft"]').click();
    // Save confirmation should appear.
    await expect(page.locator("#output")).toContainText("Saved draft");
    // View should now show the draft preview.
    await page.locator('button[data-action="view-history"]').click();
    await expect(page.locator("#output")).toContainText(
      "draft body to remember",
    );
  });

  test("save with empty input shows a 'Save failed' message", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "   ");
    await page.locator('button[data-action="save-draft"]').click();
    await expect(page.locator("#output")).toContainText("Save failed");
  });

  test("clear empties the history view", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "to clear");
    await page.locator('button[data-action="save-draft"]').click();
    await page.locator('button[data-action="clear-history"]').click();
    await expect(page.locator("#output")).toContainText("Cleared");
    await page.locator('button[data-action="view-history"]').click();
    await expect(page.locator("#output")).toContainText("No drafts saved yet.");
  });
});

test.describe("Pro tier — licence + Polar checkout", () => {
  const VALID_KEY =
    "grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  test("check-licence on fresh state reports NOT active", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await page.locator('button[data-action="clear-licence"]').click();
    await page.locator('button[data-action="check-licence"]').click();
    await expect(page.locator("#output")).toContainText("NOT active");
  });

  test("save-licence with valid shape activates Pro", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await page.locator('button[data-action="clear-licence"]').click();
    await page.locator("#licence-input").fill(VALID_KEY);
    await page.locator('button[data-action="save-licence"]').click();
    await expect(page.locator("#output")).toContainText("Licence saved");
    await page.locator('button[data-action="check-licence"]').click();
    await expect(page.locator("#output")).toContainText("Pro tier ACTIVE");
  });

  test("save-licence with malformed input shows failure message", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await page.locator('button[data-action="clear-licence"]').click();
    await page.locator("#licence-input").fill("not-a-valid-key");
    await page.locator('button[data-action="save-licence"]').click();
    await expect(page.locator("#output")).toContainText(
      "Licence save failed",
    );
  });

  test("clear-licence removes an active licence", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await page.locator("#licence-input").fill(VALID_KEY);
    await page.locator('button[data-action="save-licence"]').click();
    await page.locator('button[data-action="clear-licence"]').click();
    await expect(page.locator("#output")).toContainText("Licence removed");
  });
});

test.describe("adversarial — no-op detector", () => {
  test("every transform button produces output that differs from input", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    // Multi-handle input so 'handles' produces a join (single-item handles
    // legitimately passes through, which would false-flag this assertion).
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
    ];
    for (const k of keys) {
      await setInput(page, input);
      await page.locator(`button[data-transform="${k}"]`).click();
      const out = await output(page);
      expect(out).not.toBe(input);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});

test.describe("Clean Receipt", () => {
  test("receipt + copy buttons are present", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await expect(page.locator('button[data-action="receipt"]')).toBeVisible();
    await expect(
      page.locator('button[data-action="copy-receipt"]'),
    ).toBeVisible();
  });

  test("make receipt on a clean post renders a CLEAN RECEIPT", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "We shipped the patch today. Tests are green.");
    await page.locator('button[data-action="receipt"]').click();
    const out = await output(page);
    expect(out).toContain("grip-post");
    expect(out).toContain("CLEAN RECEIPT");
    expect(out).toContain("nothing left your device");
  });

  test("make receipt on fluff renders NEEDS WORK", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(
      page,
      "Thrilled to announce our revolutionary, game-changing solution.",
    );
    await page.locator('button[data-action="receipt"]').click();
    expect(await output(page)).toContain("NEEDS WORK");
  });

  test("copy before make prompts to make a receipt first", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await page.locator('button[data-action="copy-receipt"]').click();
    await expect(page.locator("#output")).toContainText("Make a receipt first");
  });
});
