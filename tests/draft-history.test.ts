import { describe, it, expect, beforeEach } from "vitest";
import {
  saveDraft,
  getDrafts,
  clearDrafts,
  deleteDraft,
  inMemoryStorage,
  HISTORY_CAP,
  type StorageBackend,
} from "../src/lib/draft-history";

let storage: StorageBackend;

beforeEach(() => {
  // Fresh in-memory storage per test — no cross-test pollution.
  storage = inMemoryStorage();
});

describe("saveDraft", () => {
  it("returns an entry with id, text, savedAt", async () => {
    const e = await saveDraft("hello", storage);
    expect(e.id).toMatch(/.+/);
    expect(e.text).toBe("hello");
    expect(typeof e.savedAt).toBe("number");
    expect(e.savedAt).toBeGreaterThan(0);
  });
  it("throws on empty input", async () => {
    await expect(saveDraft("", storage)).rejects.toThrow();
  });
  it("throws on whitespace-only input", async () => {
    await expect(saveDraft("   \n  ", storage)).rejects.toThrow();
  });
  it("persists so getDrafts returns the saved entry", async () => {
    await saveDraft("hello", storage);
    const drafts = await getDrafts(storage);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toBe("hello");
  });
});

describe("getDrafts — order", () => {
  it("returns newest first", async () => {
    await saveDraft("first", storage);
    await new Promise((r) => setTimeout(r, 2));
    await saveDraft("second", storage);
    await new Promise((r) => setTimeout(r, 2));
    await saveDraft("third", storage);
    const drafts = await getDrafts(storage);
    expect(drafts.map((d) => d.text)).toEqual(["third", "second", "first"]);
  });
  it("returns [] on a fresh storage", async () => {
    expect(await getDrafts(storage)).toEqual([]);
  });
});

describe("getDrafts — corruption tolerance", () => {
  it("returns [] when storage holds non-array data", async () => {
    await storage.set({ "grip-post.draft-history": "garbage" });
    expect(await getDrafts(storage)).toEqual([]);
  });
  it("drops malformed entries from a mixed array", async () => {
    await storage.set({
      "grip-post.draft-history": [
        { id: "1", text: "ok", savedAt: 1 },
        { broken: true },
        { id: "2", text: "ok2", savedAt: 2 },
      ],
    });
    const drafts = await getDrafts(storage);
    expect(drafts).toHaveLength(2);
    expect(drafts.map((d) => d.text)).toEqual(["ok", "ok2"]);
  });
});

describe("FIFO cap", () => {
  it("evicts oldest when count exceeds HISTORY_CAP", async () => {
    // Save HISTORY_CAP + 5 drafts.
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      await saveDraft(`draft-${i}`, storage);
    }
    const drafts = await getDrafts(storage);
    expect(drafts).toHaveLength(HISTORY_CAP);
    // Newest = HISTORY_CAP+4, oldest retained = 5.
    expect(drafts[0].text).toBe(`draft-${HISTORY_CAP + 4}`);
    expect(drafts[drafts.length - 1].text).toBe("draft-5");
  });
});

describe("clearDrafts", () => {
  it("removes all drafts", async () => {
    await saveDraft("a", storage);
    await saveDraft("b", storage);
    await clearDrafts(storage);
    expect(await getDrafts(storage)).toEqual([]);
  });
  it("is idempotent on empty storage", async () => {
    await clearDrafts(storage);
    await clearDrafts(storage);
    expect(await getDrafts(storage)).toEqual([]);
  });
});

describe("deleteDraft", () => {
  it("removes one entry by id", async () => {
    const e1 = await saveDraft("a", storage);
    await saveDraft("b", storage);
    const removed = await deleteDraft(e1.id, storage);
    expect(removed).toBe(true);
    const remaining = await getDrafts(storage);
    expect(remaining.map((d) => d.text)).toEqual(["b"]);
  });
  it("returns false when id not found", async () => {
    await saveDraft("a", storage);
    const removed = await deleteDraft("nonexistent-id", storage);
    expect(removed).toBe(false);
    expect(await getDrafts(storage)).toHaveLength(1);
  });
});

describe("inMemoryStorage — isolation", () => {
  it("two stores are independent", async () => {
    const s1 = inMemoryStorage();
    const s2 = inMemoryStorage();
    await saveDraft("only-in-s1", s1);
    expect(await getDrafts(s1)).toHaveLength(1);
    expect(await getDrafts(s2)).toHaveLength(0);
  });
});

describe("draft ids — uniqueness under fast successive saves", () => {
  it("generates distinct ids even when saved within the same ms", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const e = await saveDraft(`x${i}`, storage);
      ids.add(e.id);
    }
    expect(ids.size).toBe(20);
  });
});
