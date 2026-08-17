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

// ---------------------------------------------------------------------------
// Selection-scoped editing — the regression anchor for the reported bug.
//
// Before the fix, src/sidepanel.ts read input.value wholesale and ignored
// selectionStart/selectionEnd, so selecting one word and clicking Bold bolded
// the entire draft. The first test below FAILS against that implementation:
// it asserts the unselected sentences come back byte-identical. If anyone
// reverts to reading the whole value, this goes red.
// ---------------------------------------------------------------------------

/** Set a real selection on the textarea and let the app observe it. */
async function select(
  page: import("@playwright/test").Page,
  start: number,
  end: number,
) {
  await page.locator("#input").evaluate(
    (el, r) => {
      const t = el as HTMLTextAreaElement;
      t.focus();
      t.setSelectionRange(r.start, r.end);
      t.dispatchEvent(new Event("select", { bubbles: true }));
    },
    { start, end },
  );
}

async function doc(page: import("@playwright/test").Page): Promise<string> {
  return page.locator("#input").inputValue();
}

test.describe("selection-scoped transforms", () => {
  const A = "First sentence stays.";
  const B = "Middle one changes.";
  const C = "Last sentence stays.";
  const POST = `${A}\n${B}\n${C}`;

  test("bold applies to the selection and leaves the rest byte-identical", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, POST);
    await select(page, POST.indexOf(B), POST.indexOf(B) + B.length);
    await page.locator('button[data-transform="bold"]').click();

    const after = await doc(page);
    // The untouched sentences survive exactly — this is the whole complaint.
    expect(after.startsWith(`${A}\n`)).toBe(true);
    expect(after.endsWith(`\n${C}`)).toBe(true);
    // The selected sentence is now bold, so its plain form is gone.
    expect(after).not.toContain(B);
    expect(after).toContain("\u{1D5E0}"); // math sans-serif bold m
  });

  test("a collapsed selection still transforms the whole document", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "abc");
    await select(page, 1, 1);
    await page.locator('button[data-transform="bold"]').click();
    expect(await doc(page)).toBe("\u{1D5EE}\u{1D5EF}\u{1D5F0}");
  });

  test("two transforms compose on different spans", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "alpha beta");
    await select(page, 0, 5);
    await page.locator('button[data-transform="bold"]').click();
    const afterBold = await doc(page);
    // Re-select "beta" by its position in the NEW text — bold is astral, so
    // the offsets moved, which is exactly why applyToRange returns a range.
    const betaAt = afterBold.indexOf("beta");
    await select(page, betaAt, betaAt + 4);
    await page.locator('button[data-transform="italic"]').click();

    const final = await doc(page);
    expect(final).toContain("\u{1D5EE}"); // bold a, from "alpha"
    expect(final).toContain("\u{1D622}"); // italic a, from "beta"
    expect(final).not.toContain("alpha");
    expect(final).not.toContain("beta");
  });

  test("a report transform never edits the document", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    const draft = "Our revolutionary product is here.";
    await setInput(page, draft);
    await page.locator('button[data-transform="check"]').click();
    // The safety property: a report answers in the output panel and the
    // user's post is untouched.
    expect(await doc(page)).toBe(draft);
    expect(await output(page)).toContain("Verdict: DENY");
  });
});

test.describe("undo and redo", () => {
  test("undo restores the exact previous text", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "hello");
    await select(page, 0, 5);
    await page.locator('button[data-transform="bold"]').click();
    expect(await doc(page)).not.toBe("hello");
    await page.locator('button[data-action="undo"]').click();
    expect(await doc(page)).toBe("hello");
  });

  test("two transforms then two undos returns the original", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "one two");
    await select(page, 0, 3);
    await page.locator('button[data-transform="bold"]').click();
    const mid = await doc(page);
    await select(page, mid.length - 3, mid.length);
    await page.locator('button[data-transform="italic"]').click();
    await page.locator('button[data-action="undo"]').click();
    await page.locator('button[data-action="undo"]').click();
    expect(await doc(page)).toBe("one two");
  });

  test("redo re-applies what undo took away", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "redo me");
    await select(page, 0, 4);
    await page.locator('button[data-transform="bold"]').click();
    const bolded = await doc(page);
    await page.locator('button[data-action="undo"]').click();
    await page.locator('button[data-action="redo"]').click();
    expect(await doc(page)).toBe(bolded);
  });

  test("clear is undoable", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "do not lose this");
    await page.locator('button[data-action="clear-input"]').click();
    expect(await doc(page)).toBe("");
    await page.locator('button[data-action="undo"]').click();
    expect(await doc(page)).toBe("do not lose this");
  });
});

test.describe("line transforms and metrics", () => {
  test("bullets expand a mid-line selection to whole lines", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    const list = "first\nsecond\nthird";
    await setInput(page, list);
    // A range starting mid-word in line 2 and ending mid-word in line 3.
    await select(page, 8, 15);
    await page.locator('button[data-transform="bullet-dot"]').click();
    const after = await doc(page);
    // Lines 2 and 3 are bulleted whole; line 1 is untouched.
    expect(after).toBe("first\n• second\n• third");
  });

  test("metrics count graphemes, not UTF-16 units", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "abc");
    await select(page, 0, 3);
    await page.locator('button[data-transform="bold"]').click();
    // Three bold letters are 3 graphemes but 6 UTF-16 units. The metrics
    // line must say 3, or every styled post reads as twice its true length.
    await expect(page.locator("#metrics")).toContainText("3 chars");
    await expect(page.locator("#metrics")).toContainText("3 styled");
  });
});

test.describe("collapsed-selection notice", () => {
  // Raised by the in-session council (sealed 0f47e0a5bd12886d): treating a bare
  // caret as the whole document surprises a user who put their caret down to
  // type and hit a button by mistake. The rule stays - it is right for the
  // common paste-and-click case - but the tool now says what it did.
  test("a whole-post transform from a bare caret is announced", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "some post text");
    await select(page, 4, 4); // bare caret, nothing selected
    await page.locator('button[data-transform="bold"]').click();
    await expect(page.locator("#metrics")).toContainText(
      "Nothing was selected",
    );
    await expect(page.locator("#metrics")).toContainText("Undo");
  });

  test("a real selection is NOT announced", async ({ page }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "some post text");
    await select(page, 0, 4);
    await page.locator('button[data-transform="bold"]').click();
    // A notice on every click would be noise the user learns to ignore.
    await expect(page.locator("#metrics")).not.toContainText(
      "Nothing was selected",
    );
  });
});

test.describe("no-op transforms", () => {
  // Raised by the in-session council round 2 (sealed cc4497168281aa0f).
  // Styles are idempotent, so bolding already-bold text changes nothing. If
  // that still pushed an undo step, the user would press Undo, see nothing
  // happen, and conclude undo was broken.
  test("re-applying a style does not create a dead undo step", async ({
    page,
  }) => {
    await page.goto(SIDEPANEL_URL);
    await setInput(page, "hello");
    await select(page, 0, 5);
    await page.locator('button[data-transform="bold"]').click();
    const bolded = await doc(page);

    // Bold it again — idempotent, so the text cannot change.
    await select(page, 0, bolded.length);
    await page.locator('button[data-transform="bold"]').click();
    expect(await doc(page)).toBe(bolded);

    // ONE undo must reach the original, not land on a no-op step first.
    await page.locator('button[data-action="undo"]').click();
    expect(await doc(page)).toBe("hello");
  });
});
