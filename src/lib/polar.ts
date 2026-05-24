// grip-post — Polar.sh checkout URL builder.
//
// Why Polar (vs Lemon Squeezy / Stripe): Polar is free for open-source
// projects (MIT-licensed extensions like grip-post qualify), handles
// international VAT via merchant-of-record (operator does not need to
// register for EU/UK VAT), and ships a single product page per SKU
// (KISS — no Stripe Checkout Session API to wire up from a Chrome
// extension that cannot run server-side code).
//
// Architecture: the extension's "Buy Pro" button opens the Polar
// product page in a new tab. Polar handles payment + email. Their
// webhook (v0.3, server-side) issues a `grip-post-pro-XXXX...` licence
// key to the buyer's email, which the operator pastes back into the
// extension's "Save licence" field. Zero secrets in the extension.
//
// V>>'s Polar org slug: `architext1` (per project_donna_v_alias_architext1).
// SKU slug: `grip-post-pro` — $4/mo recurring subscription (early access).
//
// **v0.0.1 honest scope**: the Polar checkout page is live and accepts
// subscriptions, but the AI closer rewriter itself ships in v0.3. Buyers
// at v0.0.1/v0.1/v0.2 are early-access subscribers funding the build;
// the Polar product description makes this explicit.
//
// **Pricing data model (corrected 2026-05-24)**: Polar enforces ONE
// pricing mode per product — one-time XOR recurring, not both. The
// original W9 docs claimed dual-option per product; that was false (V>>
// caught it on the Polar UI). v0.0.1 ships subscription only ($4/mo); a
// future one-time tier would need a second product + second checkout URL.

/** Polar.sh product page for the grip-post Pro tier. */
export const POLAR_PRO_CHECKOUT_URL =
  "https://polar.sh/architext1/grip-post-pro";

/**
 * Optional URL builder for tracking which install initiated checkout.
 * Polar accepts arbitrary query params and forwards them to the
 * thank-you page; the operator's email lives there, so we don't need
 * to extract it ourselves.
 *
 * Usage from the side panel:
 *   const url = buildCheckoutUrl({ source: "sidepanel" });
 *   chrome.tabs.create({ url });
 */
export interface CheckoutOptions {
  /** Short tag identifying the click source ("sidepanel" / "context-menu"). */
  readonly source?: string;
  /** Optional pre-fill email if the operator's already typed one. */
  readonly email?: string;
}

export function buildCheckoutUrl(opts: CheckoutOptions = {}): string {
  const url = new URL(POLAR_PRO_CHECKOUT_URL);
  if (opts.source) url.searchParams.set("source", opts.source);
  if (opts.email) url.searchParams.set("customer_email", opts.email);
  return url.toString();
}
