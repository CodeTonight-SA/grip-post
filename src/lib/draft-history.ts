// grip-post draft history — local-first, opt-in, capability-locked storage.
//
// Privacy invariants:
//   - Storage is `chrome.storage.local` (per-extension, per-device, never
//     syncs across devices, never leaves the operator's machine).
//   - No telemetry. No remote backup. No third-party access.
//   - Operator can `clearDrafts()` at any time; the API surface includes
//     a `clearDrafts` for a one-click panic button (W7+ UI).
//   - FIFO cap (`HISTORY_CAP`) prevents unbounded growth.
//
// Testability: storage is dependency-injected via the `StorageBackend`
// interface so the impl is testable without a real Chrome runtime. The
// default backend at runtime probes `chrome.storage.local` and falls back
// to a no-op in-memory shim when the extension API is absent (e.g. when
// the side panel HTML is opened directly for development).

export interface DraftEntry {
  /** Stable per-draft id (epoch-ms + random suffix). */
  readonly id: string;
  /** The full draft text — preserved verbatim. */
  readonly text: string;
  /** Epoch milliseconds at save time. */
  readonly savedAt: number;
}

/** Minimal storage shape we depend on. Matches a subset of `chrome.storage.local`. */
export interface StorageBackend {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Key under which the draft list is persisted. */
export const HISTORY_KEY = "grip-post.draft-history";

/** FIFO cap — older drafts evicted past this count. KISS. */
export const HISTORY_CAP = 20;

/**
 * Build an in-memory storage backend. Useful as the default fallback when
 * `chrome.storage.local` is absent, and as the test substrate.
 *
 * The backend is a closure over a `Map`; each call to `inMemoryStorage()`
 * yields a fresh independent store, which is what tests want.
 */
export function inMemoryStorage(): StorageBackend {
  const store = new Map<string, unknown>();
  return {
    async get(key: string): Promise<Record<string, unknown>> {
      return store.has(key) ? { [key]: store.get(key) } : {};
    },
    async set(items: Record<string, unknown>): Promise<void> {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

/**
 * Default backend selector — uses `chrome.storage.local` when available,
 * a fresh in-memory store otherwise. The fallback's drafts vanish on
 * reload, which is the correct dev-mode behaviour (no persistence pollution).
 */
export function defaultStorage(): StorageBackend {
  // `chrome` global is provided by @types/chrome in extension contexts.
  // Use a guarded any-cast so this file compiles + tests cleanly under Node.
  const g = globalThis as unknown as {
    chrome?: { storage?: { local?: StorageBackend } };
  };
  const local = g.chrome?.storage?.local;
  return local ?? inMemoryStorage();
}

/** Generate a draft id; epoch-ms + 6-char random suffix for collision safety. */
function newId(): string {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}-${r}`;
}

/**
 * Save a draft. Returns the saved entry. FIFO cap enforced — oldest
 * dropped when the list grows past HISTORY_CAP.
 *
 * Throws on empty/whitespace-only input (saving an empty draft is almost
 * never what the operator means; fail loud rather than poison the list).
 */
export async function saveDraft(
  text: string,
  storage: StorageBackend = defaultStorage(),
): Promise<DraftEntry> {
  if (text.trim().length === 0) {
    throw new Error("Cannot save empty draft.");
  }
  const existing = await getDrafts(storage);
  const entry: DraftEntry = { id: newId(), text, savedAt: Date.now() };
  // Newest first; drop overflow from the tail.
  const next = [entry, ...existing].slice(0, HISTORY_CAP);
  await storage.set({ [HISTORY_KEY]: next });
  return entry;
}

/**
 * Get drafts, newest first. Returns `[]` when no history exists.
 * Robust to corrupt stored data — returns `[]` rather than throw.
 */
export async function getDrafts(
  storage: StorageBackend = defaultStorage(),
): Promise<DraftEntry[]> {
  const stored = await storage.get(HISTORY_KEY);
  const raw = stored[HISTORY_KEY];
  if (!Array.isArray(raw)) return [];
  // Defensive: every entry must look like a DraftEntry; drop the rest.
  const valid: DraftEntry[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as DraftEntry).id === "string" &&
      typeof (item as DraftEntry).text === "string" &&
      typeof (item as DraftEntry).savedAt === "number"
    ) {
      valid.push(item as DraftEntry);
    }
  }
  return valid;
}

/** Delete all drafts. Idempotent — calling on an empty history is fine. */
export async function clearDrafts(
  storage: StorageBackend = defaultStorage(),
): Promise<void> {
  await storage.remove(HISTORY_KEY);
}

/**
 * Delete one draft by id. Returns `true` if removed, `false` if not found.
 * Useful for per-entry deletion in the UI.
 */
export async function deleteDraft(
  id: string,
  storage: StorageBackend = defaultStorage(),
): Promise<boolean> {
  const drafts = await getDrafts(storage);
  const next = drafts.filter((d) => d.id !== id);
  if (next.length === drafts.length) return false;
  await storage.set({ [HISTORY_KEY]: next });
  return true;
}
