# Product Hunt Launch — grip-post

Operator-facing copy for V>>'s manual PH submission at W11.

## Name

`grip-post`

## Tagline (60-char limit)

```
A LinkedIn tool that refuses to write fluff.
```

(45 chars.)

## Description

```
Format LinkedIn posts with real Unicode (bold, italic, brackets, arrows). Then a gate refuses 25 banned phrases — "revolutionary", "thrilled to announce", "thought leader" — and flags unsourced claims like "studies show" without a citation. Refusal is a feature.

Free: 10 transforms + anti-fluff check + R0 grounding regex + local draft history. Pro ($9 one-time or $4/mo): AI closer rewriter that routes through HAL with an anti-fluff floor BEFORE the LLM call (so banned phrases never reach the model). Zero telemetry. host_permissions allowlist is linkedin.com only — any other network call is blocked by Chrome's CSP.

Open source, MIT. Banned-phrase list lives in source — review it, propose additions via PR. Capability lock verifier in CI catches any permission widening.
```

## Topics

- Productivity
- Browser Extensions
- Writing
- LinkedIn
- Open Source

## Maker comment (V>>'s post on launch day)

```
Hi 👋

I built grip-post because every AI writing tool I tried produced the same hollow LinkedIn-fluff phrases. So I made one that REFUSES.

The gate is 25 hardcoded phrases — "revolutionary", "thought leader", "thrilled to announce" — and it's deliberately small. You can read the whole list in 30 seconds: github.com/CodeTonight-SA/grip-post/blob/main/src/lib/anti-fluff.ts

The Pro tier ($9 one-time, $4/mo) wires the closer rewriter to HAL /api/infer with the anti-fluff regex floor running BEFORE the LLM call. The model never sees a banned phrase, so it cannot output one.

Zero telemetry. host_permissions is linkedin.com only. Privacy policy is one Markdown file: github.com/CodeTonight-SA/grip-post/blob/main/docs/PRIVACY.md

Refusal is a feature.
```

## OG image specs

- 1200 x 630 PNG
- Background: same brand colour as Chrome promo tile (#FF6B35 on #1A1A1A)
- Overlay text: **"A LinkedIn tool that refuses to write fluff."**
- Small logo: grip-post wordmark, sans-serif
- File: `docs/og.png` (generate via Remotion or Figma; V>> picks)

## Schedule

Per V>>'s judgement. Suggested:

- **Day 0**: Chrome Web Store approved, install URL live.
- **Day 1**: Product Hunt submission at 00:01 PST (catches the full 24-hour vote window).
- **Day 1+**: V>>'s personal LinkedIn post linking the PH listing AND the install URL, formatted using grip-post itself (dogfood).
- **Day 1+**: Cross-post to Hacker News "Show HN" — separate vote ecosystem, different audience.

## What V>> needs

1. Logged-in PH maker account.
2. The OG image (1200x630 PNG).
3. 3-5 screenshots (same as Chrome Web Store listing — reusable).
4. 1-minute demo video (optional but high-signal — Remotion can render from `scripts/remotion-record.tsx` once V>> writes the script).
5. The install URL from Chrome Web Store (cannot submit PH until store approves).
