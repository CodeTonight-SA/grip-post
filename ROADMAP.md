# grip-post · Roadmap

> *A clear starting point and a clear direction makes being incomplete acceptable.*

This roadmap is published before launch so the incompleteness is intentional, named, and shared. If your firm needs something earlier, open an issue.

---

## Where we are

**v0.0.1 — scaffold.** Empty Chrome extension that loads on `linkedin.com/feed/*` and `linkedin.com/in/*` with minimal permissions (`contextMenus`, `storage`, `sidePanel`). No features yet. CI green, leak-check green, MIT-licensed.

## Where we are going

Ten milestones. Each ships as one focused release. The order can change if a user need pulls a later milestone forward.

```
v0.0.1 ──► v0.1 ──► v0.2 ──► v0.3 ──► v0.4 ──► v1.0
scaffold  Unicode  anti-     HAL      Pro      Web Store
          toolkit  fluff     closer   features submission
          (Free)   (Free)    (Pro)    (Pro)    + Dogfood
```

### v0.1 — Unicode toolkit (Free)

Seven transforms on selected text, via right-click context menu and side panel buttons:

| Glyph class | Use |
|---|---|
| Math Sans-Serif **𝗕𝗼𝗹𝗱** (U+1D5D4–U+1D607) | Emphasis where LinkedIn has no markdown |
| Math Sans-Serif *𝘐𝘵𝘢𝘭𝘪𝘤* (U+1D608–U+1D63B) | Meta-asides |
| Corner brackets `⌜ A ⌟` | Structural framing |
| Heavy horizontal `━━━` | Section separators |
| Bullet + arrow `▸  ─→` | Tracked-step bullets |
| Middle-dot `·` | URL handle joins |
| Solid diamond `◆` | Terminal punctuation marker |

### v0.2 — Anti-fluff gate (Free)

A deterministic regex pre-filter that flags the phrases most LinkedIn posts overuse — `revolutionary`, `game-changing`, `unlock the power of`, `delve into`, `at the end of the day`, `as a thought leader`, and more. Highlights them inline before you publish. Banned-phrase list is hardcoded in source and reviewable in a single file.

### v0.3 — AI closer rewriter (Pro)

You select the last paragraph of your draft, pick an intent (`tease product`, `invite reply`, `thank a person`, `ask a question`), and the rewriter returns a better closing line — or refuses with a one-line reason. Routes through HAL (cloud and self-hosted models). The anti-fluff gate runs as the L1 floor before any LLM call.

### v0.4 — R0 grounding check + strip-AI-tells + draft history (mixed)

- **R0 grounding** (Pro) — flags claims missing a named source ("studies show…", "everyone agrees…"). Inline warning, not autocorrect.
- **Strip AI tells** (Free) — one-click removal of em-dash spam and emoji density (the two highest-signal "AI-written" markers).
- **Draft history** (Free) — last 20 drafts in `chrome.storage.local`, no cloud, no account.
- **Reason out loud** (Pro) — the closer-rewriter returns a 1-sentence reasoning above each suggestion so you see *why* this phrasing.

### v1.0 — Chrome Web Store + dogfood launch

Submission to the Chrome Web Store. Product Hunt page. Public dogfooding cadence — every post produced via grip-post links back to the extension.

---

## What this roadmap is *not*

| Out of scope | Why not |
|---|---|
| Scheduling posts | LinkedIn already does this. We compose, not schedule. |
| Multi-account / team plans | Different product, different audience. v1 is single-user. |
| Auto-posting on your behalf | Account-risk surface. The extension never posts — only edits the textarea you're already typing in. |
| Analytics dashboard | Anything that demands routine attention is suspect. |
| OAuth into LinkedIn | The extension touches only the page DOM, never LinkedIn's API. |

The discipline: every roadmap item is checked against these. If a feature replicates an existing tool, it is rejected. If it gates quality before you publish, it is considered.

---

## How we work

1. **Falsifiability** — every feature names what would prove it doesn't work. Posts using v0.1 must measurably outperform plain-text posts on engagement over 5 paired observations, or the toolkit is wrong.
2. **Plain language** — README, error messages, and docs are readable without jargon.
3. **No marketing language** — "revolutionary", "next-gen", "game-changing" are absent from code, docs, and commit messages. Specific evidence beats adjectives.
4. **Tests verify behaviour, not implementation** — Goodhart-proof. A test that always passes is worse than no test.
5. **One PR, one concern** — large changes decompose into reviewable shapes.

---

## Day-90 success metrics (post-v1.0 launch)

The project is on track if all four hold at Day 90 post Chrome Web Store launch:

- ≥200 installs
- ≥2% Pro conversion of weekly active users
- <60% anti-fluff gate denial rate on real drafts
- <$3 per active user per month in AI routing cost

If any of these breaches, the project re-scopes or stops.

---

## Where to start as a contributor

1. Read this ROADMAP and the [README](README.md).
2. Pick a `good-first-issue`.
3. Open an issue *before* writing code if your contribution touches a milestone above (v0.1–v1.0).

---

## A note on what is not here

The Pro tier (AI closer + R0 grounding + reason-out-loud) is the project's revenue model. The Free tier (Unicode toolkit + anti-fluff gate + strip-AI-tells + draft history) is the project's contribution to the LinkedIn writing experience. The split is permanent.
