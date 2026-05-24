# Privacy Policy — grip-post

**Last updated**: 2026-05-24

## TL;DR

grip-post collects nothing. Every byte you produce stays on your
device. We make zero outbound network calls without your explicit
opt-in (which v0.1 does not yet offer).

## What we do NOT collect

- Your drafts. Drafts saved via the side panel live in
  `chrome.storage.local` — per-extension, per-device. They never leave
  your machine.
- Your transform output. The Unicode-formatted text never touches our
  servers because we have no servers.
- Your usage statistics. The "Show my stats" button surfaces local
  counters from `chrome.storage.local`. They are never uploaded.
- Your IP address. No fetch() calls fire from the extension to any
  domain. The `host_permissions` allowlist (`linkedin.com` only)
  blocks any accidental network call to a non-LinkedIn host at the
  browser level.
- Your email address, name, or any personally identifiable information.

## What stays on your device

- Drafts you save (up to 20, FIFO).
- Your Pro licence key (if you bought one).
- Local-only usage counters (transform clicks, fluff verdicts).

All of the above lives in `chrome.storage.local`. You can clear it
any time via the extension's "Clear history", "Remove licence", and
"Reset stats" buttons — or by removing the extension entirely.

## Pro tier (v0.3+)

When the v0.3 closer rewriter ships, the extension will POST your
draft text to `https://hal.grip-web.com/api/infer` — only when you
click the rewriter button, only with a valid Pro licence key as the
`Authorization` header, and only the draft text (no metadata, no IP
beyond what HTTP carries by default).

That request goes to HAL, which routes to a model provider you choose
per-install (cloud / self-hosted / local). The request is logged for
billing reconciliation only; the draft text is not retained beyond
the request lifecycle.

## Children's data

grip-post is not directed at children under 13. We do not knowingly
collect data from children because we do not knowingly collect data
from anyone.

## Third-party services

- **Polar.sh** (only when you click "Buy Pro"): opens
  `polar.sh/architext1/grip-post-pro` in a new tab. Polar is the
  merchant of record for the Pro tier; their privacy policy lives at
  <https://polar.sh/legal/privacy>. We do not pass any data to Polar
  from inside the extension — they receive only what you type into
  their checkout form.

## Changes

If we ever start collecting anything, this file changes first, in a
PR you can read before installing the update. The
`host_permissions` allowlist in our manifest (`linkedin.com` only) is
the structural enforcement.

## Contact

Questions: open an issue at <https://github.com/CodeTonight-SA/grip-post/issues>.
