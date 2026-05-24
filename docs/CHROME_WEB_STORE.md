# Chrome Web Store Listing — grip-post

Operator-facing checklist for V>>'s manual store-upload step at W11.

## Name

`grip-post — LinkedIn craft + anti-fluff`

(72-char limit on Chrome Web Store. Current: 39 chars.)

## Summary (short, 132-char limit)

```
Format LinkedIn posts with Unicode (bold, italic, brackets, arrows). Anti-fluff gate refuses banned phrases. Local-only, zero telemetry.
```

(132 chars exactly.)

## Description (long, 16,384-char limit; recommend < 2,000)

```
grip-post is a LinkedIn writing tool that refuses to write fluff.

WHAT IT DOES

Side panel + right-click menu give you:

• 7 Unicode transforms — bold, italic, corner brackets, heavy
  horizontal rule, bullet arrow, middle-dot handle list, diamond
  terminator. LinkedIn renders all of these natively because they
  are real Unicode characters, not formatting tags.

• Anti-fluff gate — paste your draft, click Check. The extension
  flags 25 hardcoded LinkedIn-fluff phrases ("revolutionary",
  "thrilled to announce", "thought leader", etc.) plus em-dash
  density and emoji density. Refusal is a feature. The banned-phrase
  list lives in source — review it, propose additions via PR.

• Strip AI tells — removes leading rocket-ship/lightbulb emoji,
  trailing "Thoughts? Let me know in the comments" closers, and
  excess em-dashes. Transparent change log shows exactly what was
  removed.

• R0 grounding check — flags unsourced universal claims ("studies
  show", "experts agree", percentages without citation). Surfaces
  candidates for the operator to source or soften.

• Local draft history — save up to 20 drafts to chrome.storage.local.
  Never synced. Never uploaded. One-click clear.

• Local-only stats — see your own usage counters. Zero phone-home.

PRO TIER ($4/mo subscription, early access — via Polar.sh)

The Pro features below ship in v0.3. Subscribing at v0.0.1 / v0.1 /
v0.2 locks the early-bird price and funds the build. The Pro UI is
live in the side panel now; the rewriter itself activates in v0.3
without requiring re-subscription.

• AI closer rewriter — paste a draft, pick an intent (tease product,
  invite reply, thank person, ask question), get a closing line
  rewritten through HAL /api/infer (Harness Abstraction Layer,
  CodeTonight's proprietary inference router). Anti-fluff floor runs
  BEFORE the LLM call, so banned phrases never reach the model.
  Refusal is a feature.

• R0 grounding semantic check — beyond the regex floor, an LLM
  reviews the draft for unfounded claims.

• Reason-out-loud toggle — see the model's chain-of-thought before
  the closer.

PRIVACY

Zero telemetry. Zero phone-home. host_permissions allowlist is
linkedin.com only — any other network call is blocked by Chrome's
CSP regardless of intent. Full policy: github.com/CodeTonight-SA/grip-post/blob/main/docs/PRIVACY.md

OPEN SOURCE

MIT licensed. Banned-phrase list, transform table, capability lock,
and verify-build assertions all in source. github.com/CodeTonight-SA/grip-post
```

## Category

**Productivity** (primary), **Social & Communication** (secondary).

## Language

English (United Kingdom).

## Single-purpose statement (required since 2024)

```
grip-post is a single-purpose LinkedIn writing tool. It applies
Unicode formatting to text the user pastes, flags AI-fluff phrases
in user-pasted drafts, and surfaces local-only usage stats. All
operations happen on the user's device. The Pro tier optionally
routes drafts to HAL /api/infer for a closing-line rewrite, gated
by an explicit licence key the user pastes into the side panel.
```

## Permission justifications (required by Chrome Web Store)

| Permission | Justification |
|---|---|
| `contextMenus` | Right-click on selected text in any tab shows the 10 grip-post transforms (Bold, Italic, etc.) for one-click clipboard copy. |
| `storage` | Saves drafts, Pro licence key, and local usage counters to chrome.storage.local. Zero outbound network. |
| `sidePanel` | Persistent side panel surface for the main UI (textarea + transform buttons + history). |
| `host_permissions: https://www.linkedin.com/*` | Limits the content script to linkedin.com feed and profile pages only. NO other host. The structural privacy guarantee — Chrome's CSP blocks any non-linkedin fetch from this extension regardless of source-code intent. |

## Screenshots required

Minimum 1, maximum 5 PNG screenshots at exactly 1280x800 or 640x400.

Suggested set:
1. Side panel showing the 10 transform buttons + sample input + bold output.
2. Anti-fluff "Check for fluff" verdict screen on a known-fluff draft.
3. R0 grounding check flagging "studies show 80%" as REVIEW.
4. "Your stats (local-only)" panel with sample counters + privacy notice.
5. Pro tier section with Buy/Save/Check/Remove buttons + licence input.

V>> generates these manually post-launch via Chrome's "Capture Tab" devtool or Playwright screenshot script.

## Small promotional tile (440x280 PNG)

Tagline overlay: **"A LinkedIn tool that refuses to write fluff."**

Background: GRIP brand orange (#FF6B35) on dark grey (#1A1A1A).

## Privacy policy URL

`https://github.com/CodeTonight-SA/grip-post/blob/main/docs/PRIVACY.md`

(Or host on a www subdomain when grip-post.com is registered.)

## Submission process (V>>'s manual steps)

1. Log in to <https://chrome.google.com/webstore/devconsole/> with V>>'s dev account ($5 one-time registration if first publish).
2. Click "New Item" → upload `grip-post-<version>.zip` (built via `npm run package`).
3. Paste the Name, Summary, Description above into the relevant fields.
4. Upload 5 screenshots + small promo tile.
5. Paste the single-purpose statement + permission justifications.
6. Paste the privacy policy URL.
7. Select category, language.
8. Submit for review. Chrome typically reviews in 3-7 days.
9. After approval, share the install URL.

## Post-publish

- Pin the Chrome Web Store install URL in `README.md` (replace "coming W11" placeholder).
- Update `H-GRIP-POST-1` hypothesis with the install URL + first-install timestamp.
- Day 30/60/90 checkpoints — run `npm run package`, V>> dogfoods on real LinkedIn drafts, reports anti-fluff denial rate via "Show my stats".
