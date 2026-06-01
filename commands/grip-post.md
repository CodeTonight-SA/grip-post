---
description: Format text with Unicode that survives LinkedIn paste, and run grip-post's anti-fluff gate. The terminal surface of the grip-post extension.
argument-hint: <check|strip-tells|ground-check|bold|italic|brackets|hr|arrow|handles|diamond> [text]
allowed-tools: Bash(npx tsx:*)
---

`/grip-post` runs grip-post's transforms + gates over your text using the
**same `src/lib` core the Chrome side panel uses** — no second implementation,
no drift.

Run, passing the user's argument straight through. `${CLAUDE_PLUGIN_ROOT}`
resolves to the plugin's cached repo root, so the script is always found:

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/bin/grip-post.ts $ARGUMENTS
```

Then surface the result plainly:

- **`check`** → lead with the verdict. `CLEAN` = ship it. `WARN` = a density
  tell (em-dash / emoji) — show the number, suggest trimming. `DENY` = a banned
  phrase — name it, and **do not silently rewrite it away**. Refusal is the
  feature: the user edits the draft, not the gate.
- **`bold` / `italic` / `brackets` / `hr` / `arrow` / `handles` / `diamond`**
  → return the transformed text, ready to paste into LinkedIn.
- **`strip-tells`** → show what (if anything) was removed.
- **`ground-check`** → surface unsourced-claim candidates to source or soften.

If no text is supplied inline, ask the user to paste their draft (or accept a
`--file <path>`). Keep formatting restrained — over-formatting is itself a tell.
Math-bold Unicode is not read by screen readers, so use it for emphasis, never
whole paragraphs.
