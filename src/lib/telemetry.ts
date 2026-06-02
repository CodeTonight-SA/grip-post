// grip-post telemetry — strictly local-only counters, zero network calls.
//
// The privacy contract (W10):
//   1. Every counter increment writes to chrome.storage.local only.
//   2. There is NO fetch() / XMLHttpRequest / sendBeacon / WebSocket
//      anywhere in this module.
//   3. The capability lock (verify-build.mjs W7) restricts host_permissions
//      to https://www.linkedin.com/* — any non-linkedin network call would
//      be blocked by Chrome's CSP regardless of intent.
//   4. The operator can read every stored stat via the "Show my stats" UI
//      action; clearing is one click ("Reset stats").
//   5. A v0.3 cloud-export opt-in (off by default) will land in a separate
//      module with explicit host_permission expansion + verify-build update.
//
// Why local counters at all: V>>'s Day-90 protocol (H-GRIP-POST-1) needs
// ≥200 installs / ≥2% Pro conversion / <60% anti-fluff denial rate. The
// operator can run "Show my stats" any time and copy-paste their numbers
// into a community channel voluntarily — no server-side aggregation,
// no automatic phone-home, no IP collection.

import {
  defaultStorage,
  type StorageBackend,
} from "./draft-history";

/** Storage key for the stats counters. */
export const STATS_KEY = "grip-post.stats";

/**
 * Counter event names. Strictly enumerated — a typo in a new caller fails
 * typecheck rather than silently incrementing a misspelled bucket.
 */
export type StatEvent =
  | "transform.bold"
  | "transform.italic"
  | "transform.brackets"
  | "transform.hr"
  | "transform.arrow"
  | "transform.handles"
  | "transform.diamond"
  | "transform.check"
  | "transform.strip-tells"
  | "transform.ground-check"
  | "action.save-draft"
  | "action.view-history"
  | "action.clear-history"
  | "action.buy-pro"
  | "action.save-licence"
  | "action.check-licence"
  | "action.clear-licence"
  | "action.show-stats"
  | "action.reset-stats"
  | "action.receipt"
  | "action.copy-receipt"
  | "fluff.deny"
  | "fluff.warn"
  | "fluff.clean";

export interface StatsBundle {
  /** ISO timestamp of first ever write — install proxy. */
  readonly installedAt: string;
  /** Per-event lifetime counters. */
  readonly counts: Readonly<Record<string, number>>;
}

const EMPTY_BUNDLE: StatsBundle = {
  installedAt: "(never)",
  counts: {},
};

/**
 * Read the current stats bundle. Returns the EMPTY_BUNDLE if nothing
 * has been written yet — never throws on missing data.
 */
export async function getStats(
  storage: StorageBackend = defaultStorage(),
): Promise<StatsBundle> {
  const stored = await storage.get(STATS_KEY);
  const raw = stored[STATS_KEY];
  if (!raw || typeof raw !== "object") return EMPTY_BUNDLE;
  const obj = raw as Partial<StatsBundle>;
  return {
    installedAt:
      typeof obj.installedAt === "string" ? obj.installedAt : "(unknown)",
    counts:
      obj.counts && typeof obj.counts === "object"
        ? (obj.counts as Record<string, number>)
        : {},
  };
}

/**
 * Increment one counter by N (default 1). First-ever call stamps
 * `installedAt`. Pure local — no fetch, no analytics, no IP.
 */
export async function bump(
  event: StatEvent,
  amount: number = 1,
  storage: StorageBackend = defaultStorage(),
): Promise<void> {
  const current = await getStats(storage);
  const installedAt =
    current.installedAt === "(never)" || current.installedAt === "(unknown)"
      ? new Date().toISOString()
      : current.installedAt;
  const counts: Record<string, number> = { ...current.counts };
  counts[event] = (counts[event] ?? 0) + amount;
  await storage.set({ [STATS_KEY]: { installedAt, counts } });
}

/**
 * Reset all counters AND clear the installedAt stamp. Useful for the
 * "Reset stats" UI button or when V>> dogfoods a fresh install.
 */
export async function resetStats(
  storage: StorageBackend = defaultStorage(),
): Promise<void> {
  await storage.remove(STATS_KEY);
}

/**
 * Format a human-readable stats summary. Plain text, no markdown — the
 * sidepanel <output> element renders text only. Sorted by count desc
 * within each section so the operator sees their actual usage shape.
 */
export function formatStats(bundle: StatsBundle): string {
  const lines: string[] = [];
  lines.push(`Installed: ${bundle.installedAt}`);
  lines.push("");
  const entries = Object.entries(bundle.counts).sort(
    (a, b) => b[1] - a[1],
  );
  if (entries.length === 0) {
    lines.push("No stats yet. Click some transforms to populate.");
  } else {
    lines.push(`Lifetime counters (${entries.length} events):`);
    for (const [event, n] of entries) {
      lines.push(`  ${n.toString().padStart(6, " ")}  ${event}`);
    }
  }
  lines.push("");
  lines.push("Stored LOCALLY only. Never uploaded. Zero telemetry.");
  return lines.join("\n");
}
