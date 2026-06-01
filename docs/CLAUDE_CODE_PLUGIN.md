# grip-post — Claude Code plugin

grip-post is a Chrome extension **and** a [Claude Code](https://claude.com/claude-code)
plugin. Both surfaces share one pure core (`src/lib/`), so the formatter and the
anti-fluff gate behave identically whether you are in the browser side panel or
your terminal.

This guide covers the **Claude Code / terminal** surface. For the Chrome
extension, see the [README](../README.md).

## What you get

A `/grip-post:grip-post` skill (and a plain CLI) that:

- **Formats** text with real Unicode that survives a LinkedIn paste — bold,
  italic, rules, bullets, brackets, diamonds.
- **Refuses fluff.** `check` flags 25 hardcoded LinkedIn-cringe phrases
  ("revolutionary", "thrilled to announce", "thought leader", …) plus em-dash
  and emoji density. The banned-phrase list lives in source and is never
  remote-loaded — read it in 30 seconds:
  [`src/lib/anti-fluff.ts`](../src/lib/anti-fluff.ts).
- **Strips AI tells** and **flags unsourced claims** ("studies show",
  percentages without a citation).

Everything runs locally. No network calls, no telemetry, no account.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js ≥ 20 — the skill runs the TypeScript core via `npx tsx`; `tsx` is
  fetched automatically on first run and cached by `npx`.

## Install

Inside Claude Code:

```
/plugin marketplace add CodeTonight-SA/grip-post
/plugin install grip-post@grip-post
```

Restart Claude Code (or run `/reload-plugins`) so the skill loads.

### Alternative: clone + CLI (no plugin system)

```
git clone https://github.com/CodeTonight-SA/grip-post.git
cd grip-post
npx tsx bin/grip-post.ts check --file your-draft.txt
```

## Invocation

Plugin skills are **namespaced** `/<plugin>:<skill>`. Both the plugin and the
skill are named `grip-post`, so the command is:

```
/grip-post:grip-post <command> [text]
```

| Command | What it does | Example |
|---|---|---|
| `check` | Anti-fluff verdict + report | `/grip-post:grip-post check We are thrilled to announce…` |
| `strip-tells` | Remove rocket/lightbulb openers, "Thoughts?" closers, excess em-dashes | `/grip-post:grip-post strip-tells <draft>` |
| `ground-check` | Flag unsourced "studies show" / bare-percentage claims | `/grip-post:grip-post ground-check <draft>` |
| `bold` | 𝗕𝗼𝗹𝗱 (survives LinkedIn paste) | `/grip-post:grip-post bold Hiring three engineers` |
| `italic` | 𝘐𝘵𝘢𝘭𝘪𝘤 | `/grip-post:grip-post italic a quiet aside` |
| `brackets` | ⌜ corner brackets ⌟ | `/grip-post:grip-post brackets Reading list` |
| `hr` | ━━━ heavy rule (default width 30) | `/grip-post:grip-post hr 15` |
| `arrow` | ▸  ─→  bullet | `/grip-post:grip-post arrow Ship the thing` |
| `handles` | A · B · C middle-dot list (comma-separated input) | `/grip-post:grip-post handles a.com, b.com` |
| `diamond` | append ◆ terminator | `/grip-post:grip-post diamond Fin` |

For a long draft, point the CLI at a file instead of pasting:

```
npx tsx bin/grip-post.ts check --file draft.txt
cat draft.txt | npx tsx bin/grip-post.ts strip-tells
```

## The `check` verdict

| Verdict | Meaning | What to do |
|---|---|---|
| `CLEAN` | No banned phrase, density under threshold | Ship it |
| `WARN` | Em-dash or emoji density too high (a classic AI tell) | Trim — the report shows the number |
| `DENY` | One or more banned phrases | Edit the draft. **The gate does not "fix" it for you** — refusal is the feature |

The gate is deterministic — no model, no judgement call. The phrase list is in
[`src/lib/anti-fluff.ts`](../src/lib/anti-fluff.ts); changing it takes a pull
request plus a test that proves the new entry triggers.

## One core, two surfaces

```
            src/lib/   (pure functions — no DOM, no network, no LLM)
           /         \
  Chrome side panel    bin/grip-post.ts   ← /grip-post:grip-post runs this
  (the extension)      (the Claude Code skill)
```

`bin/grip-post.ts` is a thin front-end over the same `dispatch()` table the
extension uses. Add a transform to the extension and it appears here for free —
there is no second implementation to drift. The skill is **manual-only**
(`disable-model-invocation: true`): Claude will not auto-run it; you invoke it
explicitly.

## Accessibility note

Math-style bold/italic Unicode is **not read by screen readers** — it is a
LinkedIn-formatting workaround, not accessible rich text. Use it for a word or a
headline, never for whole paragraphs.

## Managing the plugin

Run `/plugin` to open the plugin manager, where you can disable, update, or
uninstall grip-post and manage the marketplace.

## See also

- [README](../README.md) — the Chrome extension
- [ROADMAP](../ROADMAP.md) — where this is going (Pro tier, more platforms)
