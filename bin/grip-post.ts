#!/usr/bin/env node
// grip-post — minimal Claude Code plugin front-end.
//
// DOGFOOD + DRY: this CLI is a SECOND surface over the EXACT same pure core
// (`src/lib`) the Chrome side panel uses. One dispatch table, two front-ends
// (browser side panel + terminal). Adding a transform to the extension adds
// it here for free — no second implementation to drift.
//
// Run (no build needed):  npx tsx bin/grip-post.ts <cmd> [text | --file <path>]
//
//   grip-post check        --file draft.txt   # anti-fluff verdict + report
//   grip-post strip-tells  --file draft.txt   # remove AI tells, show what went
//   grip-post ground-check --file draft.txt   # R0 grounding (regex floor)
//   grip-post bold "text"                      # 𝗯𝗼𝗹𝗱 (survives LinkedIn paste)
//   grip-post hr 15                            # ━━━ heavy horizontal rule
//   echo "text" | grip-post italic             # stdin also works

import { readFileSync } from "node:fs";
import { dispatch, type TransformKey } from "../src/lib/unicode-toolkit";

const KEYS: ReadonlySet<TransformKey> = new Set([
  "bold", "italic", "brackets", "hr", "arrow", "handles", "diamond",
  "check", "strip-tells", "ground-check",
]);

/** Resolve input text: `--file <path>` → inline args → piped stdin → "". */
function readInput(args: readonly string[]): string {
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return readFileSync(args[fileIdx + 1], "utf8");
  }
  const inline = args.filter((a) => a !== "--file").join(" ");
  if (inline.trim()) return inline;
  if (process.stdin.isTTY) return ""; // no piped input — let key defaults apply
  return readFileSync(0, "utf8"); // stdin
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !KEYS.has(cmd as TransformKey)) {
  console.error(
    `grip-post: usage: grip-post <${[...KEYS].join("|")}> [text | --file <path>]`,
  );
  process.exit(2);
}

process.stdout.write(dispatch(cmd as TransformKey, readInput(rest)) + "\n");
