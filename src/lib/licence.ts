// grip-post Pro licence — local-first storage + format validation.
//
// Privacy invariant: the licence key never leaves the device until v0.3,
// when the Pro tier closer-rewriter sends it as an Authorization header
// to HAL `/api/infer`. Until then it's stored locally and validated by
// shape (regex) only. There is NO phone-home — install + storage are
// telemetry-free per the W10 contract.
//
// Format: `grip-post-pro-{32-char-base32}` (44 chars total). Generated
// server-side by the Polar.sh webhook after successful checkout (W9b).
// v0.1 ships the validator (this file) + the checkout URL (polar.ts);
// the real key issuance ships with W9b alongside V>>'s Polar product
// configuration.

import {
  defaultStorage,
  type StorageBackend,
} from "./draft-history";

/** Storage key for the persisted licence. */
export const LICENCE_KEY = "grip-post.licence";

/**
 * Regex shape for a valid Pro licence. Must start with the literal
 * `grip-post-pro-`, followed by 32 base32 chars (A-Z, 2-7). The
 * server-side issuance uses RFC 4648 base32 of a random 20-byte key.
 *
 * NOT a cryptographic check — anyone reading this source can construct a
 * matching-shape string. The real check is the HMAC validation at HAL
 * `/api/infer` (v0.3): a malformed-shape key fails fast here AND fails
 * the server check; a correct-shape but wrong-HMAC key passes here AND
 * fails at the server. Defence in depth, fail-CLOSED at the server.
 */
const LICENCE_PATTERN = /^grip-post-pro-[A-Z2-7]{32}$/;

const PREFIX = "grip-post-pro-";

/**
 * Canonicalise: lowercase the literal prefix, UPPERCASE the base32 body,
 * strip stray whitespace inside the body. The base32 alphabet is upper-
 * case per RFC 4648; the prefix is fixed-string lowercase to keep the
 * URL/copy-paste form predictable.
 */
function normalise(raw: string): string {
  const t = raw.trim();
  if (t.toLowerCase().startsWith(PREFIX)) {
    const body = t.slice(PREFIX.length).replace(/\s+/g, "").toUpperCase();
    return PREFIX + body;
  }
  return t; // shape mismatch — validator will reject
}

/**
 * Validate a licence key by shape. Returns true if the key matches the
 * canonical pattern. Does NOT make a network call (zero telemetry in v0.1)
 * and does NOT confirm cryptographic validity. Real validation lives at
 * HAL `/api/infer` (v0.3, server-side HMAC verify).
 */
export function isValidLicenceShape(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0) return false;
  return LICENCE_PATTERN.test(normalise(raw));
}

/**
 * Save a licence key to local storage. Throws on shape-invalid input —
 * better to refuse a bad key than persist garbage that fails silently
 * at every Pro feature invocation.
 */
export async function saveLicence(
  raw: string,
  storage: StorageBackend = defaultStorage(),
): Promise<string> {
  const normalised = normalise(raw);
  if (!isValidLicenceShape(normalised)) {
    throw new Error(
      `Invalid licence key shape. Expected "grip-post-pro-XXXXXXXX..." (32 base32 chars).`,
    );
  }
  await storage.set({ [LICENCE_KEY]: normalised });
  return normalised;
}

/**
 * Read the stored licence key if any. Returns the literal stored value
 * (already shape-validated at save time) or `null` if nothing stored.
 */
export async function getLicence(
  storage: StorageBackend = defaultStorage(),
): Promise<string | null> {
  const stored = await storage.get(LICENCE_KEY);
  const raw = stored[LICENCE_KEY];
  if (typeof raw !== "string") return null;
  // Defensive: re-validate shape on read. If a future bug wrote garbage,
  // we surface null + the operator can re-enter rather than crash.
  return isValidLicenceShape(raw) ? raw : null;
}

/**
 * Clear the stored licence. Useful for the "I refunded / want to unbind
 * this device" flow.
 */
export async function clearLicence(
  storage: StorageBackend = defaultStorage(),
): Promise<void> {
  await storage.remove(LICENCE_KEY);
}

/**
 * Convenience boolean — does the operator currently hold a valid-shape
 * Pro licence? Used to enable/disable Pro UI in the side panel.
 */
export async function hasProLicence(
  storage: StorageBackend = defaultStorage(),
): Promise<boolean> {
  const key = await getLicence(storage);
  return key !== null;
}
