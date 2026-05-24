// grip-post anti-fluff gate — pure functions, no DOM, no LLM.
//
// The honest moat (per broly mesh verdict, GRIP#3176 comment): a quality
// gate the user pays us to apply to their own writing. Refusal is a feature.
// Banned-phrase list is hardcoded + reviewable in source — NEVER remote-
// loaded, NEVER overridable at runtime. Adding/removing a phrase requires
// a PR + CI green + a test that proves the new entry triggers a match.

/**
 * Phrases that signal "AI-written LinkedIn fluff" with high precision.
 * Sourced from broly mesh council 2026-05-24 + ongoing review.
 *
 * **Discipline**: add a phrase here ONLY if it has near-zero false-positive
 * rate on real human writing AND high recall on AI-generated fluff. The
 * `tests/anti-fluff.test.ts` regression suite enforces both directions.
 *
 * Case-insensitive matching. Word boundaries enforced — `delve` matches
 * `Delve into` but not `Delved` (different meaning, often legitimate).
 */
export const BANNED_PHRASES: readonly string[] = [
  "revolutionary",
  "game-changing",
  "game changer",
  "groundbreaking",
  "next-generation",
  "next-gen",
  "paradigm shift",
  "unlock the power of",
  "unleash the potential",
  "delve into",
  "at the end of the day",
  "as a thought leader",
  "innovative solution",
  "synergy",
  "synergistic",
  "circle back",
  "moving forward",
  "low-hanging fruit",
  "best-in-class",
  "world-class",
  "cutting-edge",
  "state-of-the-art",
  "thrilled to announce",
  "humbled to share",
  "excited to announce",
] as const;

/** Density warning thresholds — empirically tuned, not load-bearing. */
export const DENSITY_THRESHOLDS = {
  /** Em-dash density: warn if `em-dash count / word count` exceeds this. */
  emDashRatioWarn: 0.05,
  /** Emoji density: warn if `emoji count / total char count` exceeds this. */
  emojiRatioWarn: 0.05,
  /** Adjective stack: warn if N+ adjectives appear consecutively. */
  adjectiveStackWarn: 3,
} as const;

export interface FluffMatch {
  readonly phrase: string;
  readonly start: number;
  readonly end: number;
}

export interface FluffReport {
  readonly matches: readonly FluffMatch[];
  readonly emDashCount: number;
  readonly emojiCount: number;
  readonly wordCount: number;
  readonly charCount: number;
  readonly emDashRatio: number;
  readonly emojiRatio: number;
  readonly verdict: "clean" | "warn" | "deny";
}

/** Escape regex metacharacters for safe embedding in a regex pattern. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary-aware regex per phrase. Multi-word phrases match across
 * whitespace; hyphenated phrases match literally. Case-insensitive.
 */
function phraseRegex(phrase: string): RegExp {
  const escaped = escapeRegex(phrase);
  // `\b` doesn't fire around hyphens; for hyphenated phrases we anchor on
  // start-of-string OR non-word-char only.
  return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "gi");
}

/** Find every banned-phrase occurrence; returns matches in source order. */
export function detectPhrases(text: string): FluffMatch[] {
  const out: FluffMatch[] = [];
  for (const phrase of BANNED_PHRASES) {
    const re = phraseRegex(phrase);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ phrase, start: m.index, end: m.index + m[0].length });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Count em-dash characters (U+2014). Hyphen-minus (U+002D) does not count. */
export function countEmDashes(text: string): number {
  let n = 0;
  for (const ch of text) if (ch === "—") n++;
  return n;
}

/**
 * Approximate emoji count. Emoji codepoints in the Supplementary Multilingual
 * Plane (most pictographs) live above U+1F000. This intentionally over-counts
 * a few mathematical symbols (rare in LinkedIn posts) to keep the impl KISS
 * — a perfect emoji classifier is a much larger module.
 */
export function countEmojis(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x1f000 && cp <= 0x1ffff) n++;
    else if (cp >= 0x2600 && cp <= 0x27bf) n++; // misc symbols + dingbats
  }
  return n;
}

/** Whitespace-split word count. Empty string returns 0. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Full report — banned phrases + density signals + a single verdict tag.
 *
 * Verdict rules (deterministic, no ML):
 * - `deny`  → 1+ banned phrase
 * - `warn`  → any density threshold breached
 * - `clean` → otherwise
 */
export function reportFluff(text: string): FluffReport {
  const matches = detectPhrases(text);
  const emDashCount = countEmDashes(text);
  const emojiCount = countEmojis(text);
  const wordCount = countWords(text);
  const charCount = [...text].length;

  const emDashRatio = wordCount === 0 ? 0 : emDashCount / wordCount;
  const emojiRatio = charCount === 0 ? 0 : emojiCount / charCount;

  let verdict: FluffReport["verdict"] = "clean";
  if (matches.length > 0) {
    verdict = "deny";
  } else if (
    emDashRatio > DENSITY_THRESHOLDS.emDashRatioWarn ||
    emojiRatio > DENSITY_THRESHOLDS.emojiRatioWarn
  ) {
    verdict = "warn";
  }

  return {
    matches,
    emDashCount,
    emojiCount,
    wordCount,
    charCount,
    emDashRatio,
    emojiRatio,
    verdict,
  };
}

/**
 * Plain-text formatter for the side-panel + clipboard surface. Reads as a
 * checklist the user can paste back into their draft or self-review.
 */
export function formatReport(report: FluffReport): string {
  const lines: string[] = [];
  lines.push(`Verdict: ${report.verdict.toUpperCase()}`);
  lines.push(
    `Stats: ${report.wordCount} words, ${report.charCount} chars, ` +
      `${report.emDashCount} em-dashes, ${report.emojiCount} emoji.`,
  );
  if (report.matches.length === 0) {
    lines.push("No banned phrases.");
  } else {
    lines.push(`Banned phrases (${report.matches.length}):`);
    for (const m of report.matches) {
      lines.push(`  - "${m.phrase}" at offset ${m.start}`);
    }
  }
  if (report.emDashRatio > DENSITY_THRESHOLDS.emDashRatioWarn) {
    lines.push(
      `Em-dash density ${(report.emDashRatio * 100).toFixed(1)}% exceeds ` +
        `${(DENSITY_THRESHOLDS.emDashRatioWarn * 100).toFixed(0)}% — classic AI tell.`,
    );
  }
  if (report.emojiRatio > DENSITY_THRESHOLDS.emojiRatioWarn) {
    lines.push(
      `Emoji density ${(report.emojiRatio * 100).toFixed(1)}% exceeds ` +
        `${(DENSITY_THRESHOLDS.emojiRatioWarn * 100).toFixed(0)}%.`,
    );
  }
  return lines.join("\n");
}
