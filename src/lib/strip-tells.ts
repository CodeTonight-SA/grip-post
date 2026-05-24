// grip-post strip-tells — ACTIVE counterpart to anti-fluff (which only flags).
//
// Anti-fluff detects banned phrases and reports them; the operator decides
// what to do. strip-tells goes further: for a small, deterministic set of
// well-known "AI tells" (leading rocket-ship emoji, trailing "Thoughts?"
// closers, em-dash explosions), it RETURNS THE STRIPPED TEXT plus a
// transparent change-log so the operator can see exactly what was removed
// and put any of it back. Always reversible by the operator, never by us.
//
// Pure function — no DOM, no network, no LLM. The honest moat extends here:
// removing tells is a deterministic regex pass, not a model call. v0.3 may
// add a "soft tells" Pro tier via HAL, but THIS module always works offline
// and refuses to remove ambiguous content.

/** A single edit performed by strip-tells. */
export interface StripChange {
  /** Short kind tag — stable for UI / tests. */
  readonly kind:
    | "leading-emoji-hook"
    | "trailing-call-to-action"
    | "excess-em-dash";
  /** The substring removed or replaced. */
  readonly from: string;
  /** What it became (empty string for pure deletion). */
  readonly to: string;
}

export interface StripReport {
  readonly stripped: string;
  readonly changes: readonly StripChange[];
}

/**
 * AI-signature emoji that frequently lead LinkedIn-fluff posts.
 * Conservative set: each is rarely useful as a leader in real writing.
 * Listed verbatim with explicit codepoints to avoid editor-font confusion.
 */
const HOOK_EMOJI_RE =
  /^(\s*[\u{1F680}\u{1F4A1}\u{1F525}\u{1F4AF}\u{1F389}\u{2728}\u{1F4AB}])+\s*/u;
// 🚀  💡  🔥  💯  🎉  ✨  💫

/**
 * Trailing "engagement bait" closers. Conservative: must be near end of
 * text, separated by at least one whitespace token, and form a recognisable
 * "ask for engagement" phrase.
 */
const TRAILING_CTA_PATTERNS: readonly RegExp[] = [
  /\s*Thoughts\?[\s\S]*$/i,
  /\s*Let me know (?:in the comments|your thoughts|what you think)[\s\S]*$/i,
  /\s*What (?:do you think|are your thoughts)\??[\s\S]*$/i,
  /\s*Drop a (?:comment|thought|line)[\s\S]*$/i,
  /\s*(?:Share|Tell me) your (?:thoughts|story|experience)[\s\S]*$/i,
  /\s*Agree\? Disagree\?[\s\S]*$/i,
];

/**
 * Em-dash threshold (absolute count). Replace EVERY em-dash with a period
 * (then a space) once total em-dashes exceeds this cap. Below the cap,
 * leave the prose alone — em-dashes are legitimate punctuation in
 * moderation.
 */
const EM_DASH_CAP = 2;

/** Strip leading hook emoji; returns updated text + change record (if any). */
function stripLeadingEmoji(text: string): {
  text: string;
  change: StripChange | null;
} {
  const m = text.match(HOOK_EMOJI_RE);
  if (!m) return { text, change: null };
  return {
    text: text.slice(m[0].length),
    change: { kind: "leading-emoji-hook", from: m[0], to: "" },
  };
}

/** Strip trailing CTA; first matching pattern wins (longest-match style). */
function stripTrailingCTA(text: string): {
  text: string;
  change: StripChange | null;
} {
  for (const re of TRAILING_CTA_PATTERNS) {
    const m = text.match(re);
    if (m) {
      return {
        text: text.slice(0, m.index ?? text.length),
        change: { kind: "trailing-call-to-action", from: m[0], to: "" },
      };
    }
  }
  return { text, change: null };
}

/**
 * Replace em-dashes with ". " ONLY when total count exceeds the cap.
 * One change record per replacement so the operator sees each edit.
 */
function stripExcessEmDash(text: string): {
  text: string;
  changes: StripChange[];
} {
  const total = [...text].filter((c) => c === "—").length;
  if (total <= EM_DASH_CAP) return { text, changes: [] };

  const changes: StripChange[] = [];
  // Replace ALL em-dashes once we're over cap (op intent: tighten the prose).
  // Use surrounding-space normalisation so we don't end up with "word .  word".
  const stripped = text.replace(/\s*—\s*/g, () => {
    changes.push({ kind: "excess-em-dash", from: "—", to: ". " });
    return ". ";
  });
  return { text: stripped, changes };
}

/**
 * Strip AI tells from a draft. Order is deterministic:
 *   1) leading emoji hook
 *   2) trailing call-to-action
 *   3) excess em-dashes (only if > EM_DASH_CAP)
 *
 * Returns the stripped text plus an ordered list of edits. Empty edit
 * list ⇒ nothing changed (and `stripped === input`).
 */
export function stripTells(input: string): StripReport {
  const changes: StripChange[] = [];
  let text = input;

  const leading = stripLeadingEmoji(text);
  text = leading.text;
  if (leading.change) changes.push(leading.change);

  const trailing = stripTrailingCTA(text);
  text = trailing.text;
  if (trailing.change) changes.push(trailing.change);

  const dashes = stripExcessEmDash(text);
  text = dashes.text;
  changes.push(...dashes.changes);

  return { stripped: text, changes };
}

/** Plain-text formatter for the side panel — what changed + before/after. */
export function formatStripReport(report: StripReport): string {
  const lines: string[] = [];
  if (report.changes.length === 0) {
    lines.push("No AI tells detected. Nothing stripped.");
    return lines.join("\n");
  }
  lines.push(`Stripped ${report.changes.length} tell(s):`);
  for (const c of report.changes) {
    const fromDisplay = c.from.length > 40
      ? c.from.slice(0, 37) + "..."
      : c.from;
    const toDisplay = c.to === "" ? "(removed)" : `"${c.to}"`;
    lines.push(`  - [${c.kind}] "${fromDisplay}" → ${toDisplay}`);
  }
  lines.push("");
  lines.push("--- Stripped output ---");
  lines.push(report.stripped);
  return lines.join("\n");
}
