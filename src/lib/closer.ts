// grip-post Pro tier — intent-aware closer rewriter (interface + stub impl).
//
// **Capability lock** (per untrusted-content-capability-lock PARAMOUNT):
// the only operation this contract permits is closer rewriting. No
// arbitrary prompt forwarding, no tool-call surface, no document
// generation. The server side accepts `{draft, intent}` and returns
// `{closer, reasoning}` — anything else is rejected at the endpoint.
//
// **Anti-fluff baked in by construction**: the implementation in W6 will
// route the draft through `reportFluff` BEFORE the LLM call. A draft that
// trips the gate gets `null` closer + refusal reasoning. The LLM is never
// asked to "rewrite without fluff" — that begs the model to lie. Instead
// the LLM only sees drafts that already pass the regex floor, with a
// system prompt that says "return the closer or refuse with a one-line
// reason". Refusal is a feature.
//
// **Routing** (W6): HAL `/api/infer` — provider-agnostic by construction
// (cloud / self-hosted / local). The endpoint URL is configurable per
// install, defaulting to `https://hal.grip-web.com/api/infer`.
//
// **Pricing surface** (W9): a Pro licence key gates the call client-side
// (button disabled without licence) AND server-side (HAL rejects requests
// without a valid `Authorization: Bearer <licence>` header).

import { reportFluff } from "./anti-fluff";

/**
 * The four intents the side panel offers for closer rewriting. Each maps
 * to a system-prompt fragment on the server side (W6).
 */
export type ClosingIntent =
  | "tease-product"
  | "invite-reply"
  | "thank-person"
  | "ask-question";

export interface CloserRequest {
  /** The full draft post text. The rewriter only touches the last paragraph. */
  readonly draft: string;
  /** Operator-selected intent for the closer. */
  readonly intent: ClosingIntent;
  /** Optional Pro licence key for server-side auth. Required for non-stub impl. */
  readonly licenceKey?: string;
  /**
   * Pro tier toggle: when true, the rewriter exposes its chain-of-thought
   * before the closer. v0.3 will stream HAL's reasoning tokens; the v0.1
   * stub merely produces a richer refusal explanation so the contract
   * surface is testable end-to-end.
   */
  readonly reasonOutLoud?: boolean;
}

export interface CloserResponse {
  /**
   * The rewritten closing line, or `null` if the rewriter refused.
   * Refusal is a feature, not a failure — the operator sees the
   * reasoning and edits the draft themselves.
   */
  readonly closer: string | null;
  /** One-sentence reasoning, always present. */
  readonly reasoning: string;
}

/** Default HAL endpoint. Override per-install via the side panel settings (W7). */
export const DEFAULT_HAL_ENDPOINT = "https://hal.grip-web.com/api/infer";

/**
 * Stub implementation. **W6 replaces with a real HAL POST.**
 *
 * The stub honours one invariant exactly: it always refuses, with a
 * reasoning string that names what would happen in W6+. This is
 * fail-CLOSED — a Pro tier that silently returned `closer: "[TODO]"`
 * could ship to LinkedIn drafts and embarrass the operator. Refusal
 * cannot.
 *
 * The stub also runs `reportFluff` on the draft so the anti-fluff
 * floor is exercised end-to-end even during v0.1 / v0.2. If the draft
 * trips the floor, the refusal names the banned phrase.
 */
export async function rewriteCloser(
  req: CloserRequest,
  _endpoint: string = DEFAULT_HAL_ENDPOINT,
): Promise<CloserResponse> {
  // Anti-fluff floor — always runs, even in the stub.
  const fluff = reportFluff(req.draft);
  if (fluff.verdict === "deny") {
    const first = fluff.matches[0];
    return {
      closer: null,
      reasoning:
        `Refused: draft contains banned phrase "${first.phrase}". ` +
        `Edit the draft first, then re-run.`,
    };
  }
  if (!req.licenceKey) {
    return {
      closer: null,
      reasoning:
        "Pro tier requires a licence key. Buy at grip-post.com/pro " +
        "($9 one-time or $4/mo).",
    };
  }
  // v0.1 + v0.2 stub — v0.3 wires the real HAL call.
  // Reason-out-loud toggle expands the reasoning text without changing the
  // verdict (still null closer). The differential is testable: with the
  // flag the reasoning is materially longer + names the intent + names
  // the v0.3 routing target.
  if (req.reasonOutLoud) {
    return {
      closer: null,
      reasoning:
        `Pro tier scaffolded (verbose). Intent: ${req.intent}. ` +
        `v0.3 will route this through HAL /api/infer with an intent-shaped ` +
        `system prompt, capability-locked to "closer rewrite" — no general ` +
        `prompt forwarding. Refusal is a feature: until the real call ships, ` +
        `the stub stays fail-CLOSED so silent "[TODO]" closers cannot leak ` +
        `into LinkedIn drafts.`,
    };
  }
  return {
    closer: null,
    reasoning:
      `Pro tier scaffolded; HAL call ships in v0.3 (intent: ${req.intent}).`,
  };
}
