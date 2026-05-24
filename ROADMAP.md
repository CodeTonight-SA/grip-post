# grip-post · Roadmap

> *A clear starting point and a clear direction makes being incomplete acceptable.*

## Like I'm five

Imagine you write something for LinkedIn. A little robot helper does three things, in this order:

1. **Pretty it up** — turns plain letters into bold-looking letters that survive copy-paste, adds nice arrows and dots so the post looks tidy.
2. **Catch the cringe** — if you wrote "thrilled to announce", "thought leader", or "revolutionary", the helper refuses to let you sound like a robot. It shows you which words it doesn't like.
3. **Suggest a better ending (the paid bit)** — for $4/month, the helper writes the last line for you. But this part is still being built — the door opens in version 0.3.

We are at **version 0.1 right now**. The pretty-it-up and catch-the-cringe parts work. The suggest-the-ending part is coming.

## At a glance

| Version | Theme | Status | Tracking |
|---|---|---|---|
| **v0.1** | Free tier — formatter + fluff gate + local-only everything | ✅ Shipped | [#1](https://github.com/CodeTonight-SA/grip-post/issues/1) |
| **v0.2** | Polish — screenshots, keyboard shortcuts, dark mode, dogfood-fed banlist | 🔜 1-2 weeks post-launch | [#2](https://github.com/CodeTonight-SA/grip-post/issues/2) |
| **v0.3** | **Pro tier activates** — HAL wired up, real AI rewriter, auto licence keys | 🎯 ~4 weeks post-launch | [#3](https://github.com/CodeTonight-SA/grip-post/issues/3) |
| **v0.4** | Broader reach — X / Mastodon / BlueSky, multi-language banlists | 🔮 ~8 weeks | [#4](https://github.com/CodeTonight-SA/grip-post/issues/4) |
| **v0.5+** | Ecosystem — team licences, Firefox port, mobile companion | 🔮 Open-ended | [#5](https://github.com/CodeTonight-SA/grip-post/issues/5) |

## v0.1 — Free tier ✅ (current)

### What you get

- **7 Unicode transforms**: bold (𝗯𝗼𝗹𝗱), italic (𝘪𝘵𝘢𝘭𝘪𝘤), corner brackets (⌜ X ⌟), heavy horizontal rule (━━━), bullet arrow (▸ ─→), middle-dot handle list (A · B · C), diamond terminator (◆). All are real Unicode characters, so LinkedIn cannot strip them.
- **Anti-fluff check**: paste a draft, click "Check". Flags 25 hardcoded LinkedIn-cringe phrases ("revolutionary", "thrilled to announce", "thought leader", etc.) plus em-dash density and emoji density. The list lives in source — read it in 30 seconds: [`src/lib/anti-fluff.ts`](src/lib/anti-fluff.ts).
- **Strip AI tells**: removes leading rocket-ship / lightbulb emoji, trailing "Thoughts? Let me know in the comments" closers, and excess em-dashes. Shows exactly what was removed.
- **R0 grounding check (regex)**: flags unsourced universal claims like "studies show", "experts agree", percentages without citations. Surfaces candidates for you to source or soften. (Smarter LLM version is v0.3 Pro.)
- **Local draft history**: save up to 20 drafts to `chrome.storage.local`. FIFO. Never synced. Never uploaded. One-click clear.
- **Local-only usage stats**: see your own counters via "Show my stats". Zero phone-home.

### Privacy floor (the architectural promise)

Three layers, none alone sufficient:

| Layer | Mechanism |
|---|---|
| Source | `tests/telemetry.test.ts` stubs `fetch` and asserts it's never called |
| Build | `bin/verify-build.mjs` blocks any commit that widens permissions |
| Runtime | Chrome's CSP enforces `host_permissions: linkedin.com` only |

Even if source intent ever changes, the runtime CSP blocks any non-linkedin network call.

### Pro UI is lit up — but the rewriter does NOT run yet

The side panel has the Pro section: licence-key input, Buy / Save / Check / Remove buttons. Buying opens [`polar.sh/architext1/grip-post-pro`](https://polar.sh/architext1/grip-post-pro). Licence storage works. **The rewriter itself is a stub** that returns `"scaffolded; HAL call ships in v0.3"` — the actual AI call activates in v0.3 without requiring re-subscription.

This is honest **early-access**: subscribing at $4/mo today locks the price and funds the build; the value lands at v0.3.

## v0.2 — Polish + dogfood feedback 🔜

- **Onboarding tour** the first time the side panel opens (3 dismissable cards).
- **Keyboard shortcuts** for the top 3 transforms (Cmd+B bold, Cmd+I italic, Cmd+; brackets) — discoverable via right-click menu titles.
- **Dark-mode CSS** for the side panel (currently light-only). Respects `prefers-color-scheme`.
- **Banned-phrase additions** from real-draft dogfooding by V>> + first 50 installs.
- **Em-dash density recalibration** — current 0.05 threshold may be too sensitive on real LinkedIn drafts. Recalibrate from corpus.
- **Real Chrome Web Store screenshots** post-publish (currently the launch ships with dev-panel captures; v0.2 replaces with annotated marketing visuals).
- **Bug fixes** from H-GRIP-POST-1 Day-30 dogfood findings.

**Not in v0.2 (deliberate)**: no HAL call yet (that is v0.3); no new platforms (that is v0.4).

## v0.3 — Pro tier activates 🎯 (the big one)

This is the version that earns the $4/mo. Everything below moves from "stub returning a refusal" to "real working code".

### Server-side build (CodeTonight internal, not in this repo)

- **HAL `/api/infer` endpoint** — receives `{draft, intent, licence}`, HMAC-validates the licence against Polar's webhook-issued key, routes the draft through HAL (Harness Abstraction Layer, CodeTonight's proprietary inference router) to the chosen provider (cloud / self-hosted / local; fleet default cloud).
- **Polar webhook → AgentMail** — on successful purchase, Polar fires a webhook to V>>'s server. The server generates a `grip-post-pro-XXXX...` licence key (32 random base32 chars), stores the HMAC in the validator's database, and sends the licence to the buyer's email via `grip-trial-out@agentmail.to`. Buyer pastes into the extension's Save Licence input. Done.

### Client-side activation (this repo)

- **`src/lib/closer.ts`** stub is replaced with a real `fetch` to `https://hal.grip-web.com/api/infer`. Request shape (`{draft, intent, licenceKey}`) and response shape (`{closer, reasoning}`) are already locked from v0.1 — no breaking API change.
- **`src/manifest.json`** adds `host_permissions: ["https://hal.grip-web.com/*"]`. The capability-lock verifier (`bin/verify-build.mjs`) is updated to allow this single new entry. Any OTHER host still fails CI.
- **R0 grounding semantic check** — the regex floor (v0.1) stays as L1; an LLM-powered L2 layer flags claims the regex misses. L2 may only flag, never un-flag — monotone toward "review".
- **Reason-out-loud toggle** — when on, the panel streams the model's chain-of-thought above the closer suggestion.

### Anti-fluff floor stays a hard gate

The model NEVER sees a draft containing a banned phrase. The regex check runs client-side BEFORE the request fires. If the draft trips it, the extension shows a refusal — the buyer never spent inference cost on a fluff draft.

### Acceptance for v0.3 ship

- Real round-trip working in dogfood (V>> pastes a draft, gets a closer, anti-fluff floor demonstrably blocks a banned-phrase draft).
- Polar webhook → AgentMail → licence-email round-trip works for at least one real test purchase.
- Per-user inference cost stays under $3/month (H-GRIP-POST-1 budget).
- All v0.1 tests still green + new server-side suite green.

## v0.4 — Broader reach 🔮

- **Multi-platform**: X (Twitter), Mastodon, BlueSky. Each needs its own host_permissions entry AND its own formatter-quirk module (X strips most Unicode formatting; BlueSky supports more; Mastodon depends on instance).
- **Multi-language anti-fluff**: German, French, Spanish corpora. Each language is a `BANNED_PHRASES_<lang>.ts` module, opt-in via UI dropdown.
- **Opt-in encrypted cloud draft sync** (separate-namespace consent — off by default, off-by-default to keep the privacy-first floor).

## v0.5+ — Ecosystem 🔮

Open-ended. Likely candidates depending on demand signal:

- **Team licences** — Polar multi-seat, organisation-wide licence keys.
- **Firefox port** — WebExtensions polyfill (vite-plugin-web-extension can target both browsers from one source tree).
- **Mobile companion** — Capacitor wrapper, OR a separate React-Native build that shares the `src/lib/` core.
- **Localised UI** — beyond the fluff lists, full UI translation for top 5 LinkedIn markets.

## What this roadmap is *not*

| Out of scope | Why not |
|---|---|
| Scheduling posts | LinkedIn already does this. We compose, not schedule. |
| Multi-account / team plans (pre-v0.5) | Different product, different audience. v0.1–v0.4 is single-user. |
| Auto-posting on your behalf | Account-risk surface. The extension never posts — only edits the textarea you're already typing in. |
| Analytics dashboard | Anything that demands routine attention is suspect. Local stats are enough. |
| OAuth into LinkedIn | The extension touches only the page DOM, never LinkedIn's API. |

The discipline: every roadmap item is checked against these. If a feature replicates an existing tool, it is rejected. If it gates quality before you publish, it is considered.

## How we work

1. **Falsifiability** — every feature names what would prove it doesn't work. Day-90 metrics (below) are the public falsifier.
2. **Plain language** — README, error messages, docs are readable without jargon.
3. **No marketing language** — "revolutionary", "next-gen", "game-changing" are absent from code, docs, commit messages. Specific evidence beats adjectives.
4. **Tests verify behaviour, not implementation** — Goodhart-proof. A test that always passes is worse than no test.
5. **One PR, one concern** — large changes decompose into reviewable shapes.
6. **Capability lock** — the build artefact's permission surface is verified in CI. Any commit that widens permissions fails the gate (`bin/verify-build.mjs`).

## Day-90 success metrics (post-v0.1 launch)

The project is on track if ALL four hold at Day 90 post Chrome Web Store launch (deadline 2026-09-12, tracked as hypothesis H-GRIP-POST-1):

- ≥200 installs
- ≥2% Pro conversion of weekly active users
- <60% anti-fluff gate denial rate on real drafts
- <$3 per active user per month in AI routing cost

If any of these breaches, the project re-scopes or stops.

## Versioning

| Marker | Meaning |
|---|---|
| `package.json` version | The actual code-shipped number. Currently `0.0.1` (dev tag). Bumped to `0.1.0` on Chrome Web Store first submission. |
| Roadmap "v0.1" | The launch milestone. Aligns with `0.1.0` once `package.json` is bumped at store-submit time. |
| H-GRIP-POST-1 | The Day-90 success hypothesis (deadline 2026-09-12). Verifies all four metrics above. |

## Where to start as a contributor

1. Read this ROADMAP and the [README](README.md).
2. Pick a milestone issue (linked in the "At a glance" table).
3. Open an issue *before* writing code if your contribution touches a milestone above.
4. The CI gates (unit + E2E + capability-lock verify + leak-check) must all pass.
5. PR description follows the 4-row Anti-Drift template: `Done · Remaining · Open · Next`.

## A note on what is not here

The Pro tier (AI closer + R0 grounding semantic check + reason-out-loud) is the project's revenue model. The Free tier (Unicode toolkit + anti-fluff gate + strip-AI-tells + draft history + local stats) is the project's contribution to the LinkedIn writing experience. The split is permanent.
