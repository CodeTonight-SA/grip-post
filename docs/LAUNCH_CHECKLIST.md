# Launch Checklist — grip-post v0.0.1 → v1.0

V>>'s manual steps for the W11 launch. Each item is autonomous-unsafe
(requires V>>'s account / signature / judgement).

## Pre-flight (do once)

- [ ] **Chrome Web Store developer account**. $5 one-time registration
      at <https://chrome.google.com/webstore/devconsole/>. Use V>>'s
      `architext1` email so the published extension shows the consistent
      pseudonym.
- [ ] **Polar.sh org + product**.
  - Org: `architext1` (already exists per `project_donna_v_alias_architext1`).
  - Create product: `grip-post-pro`, $9 one-time OR $4/mo subscription
    (Polar handles the dual-option page).
  - Set webhook → V>>'s server endpoint that issues
    `grip-post-pro-XXXXXXXX...` licence keys via AgentMail
    (`grip-trial-out@agentmail.to`).
  - The licence key issuance code is NOT in this repo (it lives
    server-side; see `lib/agentmail.py` shim).
- [ ] **Product Hunt maker account** (free at <https://www.producthunt.com/>).
- [ ] **`grip-post.com` domain** (optional; can launch without).

## Build + test (per release)

```bash
cd ~/CodeTonight/grip-post
git pull
npm install
npm run typecheck
npm run lint
npm test                 # 181 unit tests must pass
npm run build
npm run verify-build     # capability lock must pass
npm run test:e2e         # 16 E2E tests must pass
npm run package          # produces grip-post-0.0.1.zip
```

If any step fails: do NOT submit. Fix on a feature branch, PR, CI green, merge.

## Manual sanity check (dogfood)

- [ ] Load unpacked: chrome://extensions → Developer Mode → Load unpacked → select `dist/`.
- [ ] Open <https://www.linkedin.com/feed/>. Right-click a selection — context menu shows 10 grip-post transforms.
- [ ] Click extension icon → side panel opens.
- [ ] Paste a real fluff draft (one with "thrilled to announce"). Click Check → verdict DENY, banned phrase named.
- [ ] Click Save draft → green confirmation. Click View history → draft shows. Click Clear history → empty.
- [ ] Click Buy Pro → opens `polar.sh/architext1/grip-post-pro` in new tab.
- [ ] Paste a real Pro key (from V>>'s test purchase) → Click Save licence → "Pro features unlocked".
- [ ] Click Check status → "Pro tier ACTIVE".
- [ ] Click Show my stats → counters surface with privacy notice.

## Chrome Web Store submission

Use `docs/CHROME_WEB_STORE.md` as the source of truth for every field.

- [ ] Upload `grip-post-<version>.zip`.
- [ ] Paste Name, Summary, Description.
- [ ] Upload 5 screenshots (1280x800 PNG each).
- [ ] Upload small promo tile (440x280 PNG).
- [ ] Single-purpose statement.
- [ ] Permission justifications (4 entries).
- [ ] Privacy policy URL → `https://github.com/CodeTonight-SA/grip-post/blob/main/docs/PRIVACY.md`.
- [ ] Submit for review.

Review window: 3-7 days typical, up to 30 days for new publishers.

## Post-approval

- [ ] Update `README.md`: replace "coming W11" with the live install URL.
- [ ] Push the README update to main.
- [ ] **Verify H-GRIP-POST-1 hypothesis** via `lib/hypothesis_engine.py`
      with the install URL + first-install timestamp.

## Product Hunt launch (Day 1 of public listing)

Use `docs/PRODUCT_HUNT.md` as the source of truth.

- [ ] Submit at 00:01 PST for the full 24h vote window.
- [ ] Post the maker comment (template in PRODUCT_HUNT.md).
- [ ] V>>'s personal LinkedIn post linking the PH listing AND the
      install URL, formatted using grip-post itself (dogfood).
- [ ] Cross-post "Show HN" on Hacker News (separate vote ecosystem).

## Day 30 / 60 / 90 checkpoints (H-GRIP-POST-1 verification)

V>> queries Chrome Web Store dashboard for install count and runs
"Show my stats" on their own install for personal counters.

Hypothesis falsified if ANY of:
- < 200 total installs at Day 90.
- < 2% of WAU buy Pro at Day 90.
- > 60% anti-fluff denial rate on real drafts (suggests over-aggressive banlist).
- > $3/active-user/month HAL routing cost.

Hypothesis confirmed if ALL four metrics pass. Escalate per
`broly`-council Day-90 protocol.

## What V>> does NOT have to do

Everything in the repo is already in place:

- [x] Repo (CodeTonight-SA/grip-post, public, MIT).
- [x] CI: ci (vitest + lint + typecheck + build + capability-lock verify).
- [x] CI: leak-check (gitleaks).
- [x] CI: e2e (Playwright in headless Chromium).
- [x] All 10 features (10 transforms + anti-fluff + strip-tells +
      R0 grounding + draft history + Pro tier UI + telemetry-free stats).
- [x] 197 tests (181 vitest + 16 Playwright).
- [x] Capability lock that fails CI if anyone tries to widen permissions.
- [x] Privacy policy.
- [x] Chrome Web Store listing copy.
- [x] Product Hunt copy.
- [x] This checklist.

V>>'s job: the V>>-only steps above (dev accounts, screenshots, submission).
