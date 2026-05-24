// grip-post R0 grounding check — Pro tier (regex floor at v0.1, HAL adds
// semantic check at v0.3+).
//
// Origin: GRIP's Rule 0 ("R0 — Critical Thinking Gate"). Before any
// factual claim or generalisation: specific evidence? scope matches?
// falsification condition? This module surfaces draft sentences that look
// like *unfounded universal claims* — the most common AI-fluff failure mode
// on LinkedIn — so the operator can fix them BEFORE posting, not after a
// critic comments.
//
// Pure regex floor — no LLM, no network. Free to run, fail-CLOSED on edge
// cases (we'd rather mark legitimate prose for review than silently let an
// unfounded claim through). v0.3 will route nuanced cases through HAL
// `/api/infer` for semantic checks (the LLM-augmentation pattern: L1
// regex floor + L2 LLM recall, monotone toward "flag", fail-open to L1).

export interface GroundingFlag {
  /** Stable label — tested directly, used in UI. */
  readonly label: string;
  /** Substring start offset. */
  readonly start: number;
  /** Substring end offset (exclusive). */
  readonly end: number;
  /** The actual text matched, copied for display. */
  readonly text: string;
}

export interface GroundingReport {
  readonly flags: readonly GroundingFlag[];
  readonly verdict: "clean" | "review";
}

/**
 * Universal-claim patterns. Each entry: a regex + a stable label.
 * Conservative — each is near-certain to indicate an ungrounded claim when
 * appearing without an inline citation marker (URL, "according to", "[1]").
 *
 * Word boundaries enforced. Case-insensitive. Multi-line aware so a flag
 * inside a long post is found at its real offset.
 */
const PATTERNS: readonly { re: RegExp; label: string }[] = [
  { re: /\bstudies show\b/gi, label: "unsourced: 'studies show'" },
  { re: /\bresearch proves\b/gi, label: "unsourced: 'research proves'" },
  { re: /\bdata shows\b/gi, label: "unsourced: 'data shows'" },
  { re: /\bexperts agree\b/gi, label: "unsourced: 'experts agree'" },
  { re: /\beveryone knows\b/gi, label: "unsourced: 'everyone knows'" },
  {
    re: /\bit('s| is) been proven\b/gi,
    label: "unsourced: 'it's been proven'",
  },
  {
    re: /\bit('s| is) well[- ]known\b/gi,
    label: "unsourced: 'it's well-known'",
  },
  { re: /\bscience has shown\b/gi, label: "unsourced: 'science has shown'" },
  {
    // Universal-quantifier + (0-3 intervening words) + belief verb.
    // Catches: "everyone knows", "all experts agree", "every founder thinks",
    // "no one believes", "nobody knows".
    re: /\b(?:all|every|no|none|nobody|everyone|everybody)(?:\s+\w+){0,3}\s+(?:know|knows|believe|believes|agree|agrees|think|thinks)\b/gi,
    label: "universal claim about belief",
  },
  {
    re: /\b\d+(?:\.\d+)?\s?%/g,
    label: "statistic — needs citation",
  },
];

/** Lower-cased URL/citation markers searched per-sentence to suppress FPs. */
const CITATION_MARKERS: readonly string[] = [
  "http://",
  "https://",
  "according to ",
  "[1]",
  "[2]",
  "[3]",
  "[4]",
  "[5]",
  "source:",
  "via @",
  "see:",
  "cited in",
  "doi:",
];

/**
 * Heuristic: is the substring surrounding [start, end] within ~80 chars of
 * a citation marker? Suppresses statistic-flag false-positives when the
 * draft DOES cite a source.
 */
function hasNearbyCitation(text: string, start: number, end: number): boolean {
  const windowStart = Math.max(0, start - 80);
  const windowEnd = Math.min(text.length, end + 80);
  const window = text.slice(windowStart, windowEnd).toLowerCase();
  return CITATION_MARKERS.some((m) => window.includes(m));
}

/**
 * Run every pattern; return matches sorted by start offset. Statistics
 * with a nearby citation marker are dropped (citation present → operator
 * has done the grounding work).
 */
export function detectUngroundedClaims(text: string): GroundingFlag[] {
  const out: GroundingFlag[] = [];
  for (const { re, label } of PATTERNS) {
    let m: RegExpExecArray | null;
    // Clone the regex so concurrent calls don't share `lastIndex` state.
    const local = new RegExp(re.source, re.flags);
    while ((m = local.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Suppress statistic-flag if a citation marker is within ~80 chars.
      if (
        label === "statistic — needs citation" &&
        hasNearbyCitation(text, start, end)
      ) {
        continue;
      }
      out.push({ label, start, end, text: m[0] });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Full grounding report. Verdict semantics (deliberately binary — the goal
 * is operator review, not autonomous denial):
 *   - `review` → 1+ flag, operator should add a source or soften the claim
 *   - `clean`  → no flags
 *
 * This is a CHECK, not a gate. Anti-fluff has `deny`; R0 grounding does
 * not — the operator owns claim quality, we surface candidates.
 */
export function reportGrounding(text: string): GroundingReport {
  const flags = detectUngroundedClaims(text);
  return { flags, verdict: flags.length === 0 ? "clean" : "review" };
}

/** Plain-text formatter for the side panel. */
export function formatGroundingReport(report: GroundingReport): string {
  const lines: string[] = [];
  lines.push(`Grounding verdict: ${report.verdict.toUpperCase()}`);
  if (report.flags.length === 0) {
    lines.push("No ungrounded claims detected.");
    return lines.join("\n");
  }
  lines.push(`Claims to review (${report.flags.length}):`);
  for (const f of report.flags) {
    lines.push(`  - [${f.label}] "${f.text}" at offset ${f.start}`);
  }
  lines.push("");
  lines.push("Tip: add a source (URL, 'according to X', citation marker) or");
  lines.push("soften to first-person ('in my experience', 'I've found').");
  return lines.join("\n");
}
