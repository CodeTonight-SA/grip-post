import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidLicenceShape,
  saveLicence,
  getLicence,
  clearLicence,
  hasProLicence,
  LICENCE_KEY,
} from "../src/lib/licence";
import { inMemoryStorage, type StorageBackend } from "../src/lib/draft-history";

let storage: StorageBackend;

beforeEach(() => {
  storage = inMemoryStorage();
});

const VALID_KEY = "grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

describe("isValidLicenceShape", () => {
  it("accepts a canonical 32-base32-char Pro key", () => {
    expect(isValidLicenceShape(VALID_KEY)).toBe(true);
  });
  it("rejects an empty string", () => {
    expect(isValidLicenceShape("")).toBe(false);
  });
  it("rejects null/undefined-ish input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidLicenceShape(null as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidLicenceShape(undefined as any)).toBe(false);
  });
  it("rejects wrong prefix (e.g. 'grip-pro-...')", () => {
    expect(isValidLicenceShape("grip-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe(false);
  });
  it("rejects too-short body (31 chars instead of 32)", () => {
    expect(isValidLicenceShape("grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ23456")).toBe(false);
  });
  it("rejects too-long body (33 chars)", () => {
    expect(isValidLicenceShape("grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ2345678")).toBe(false);
  });
  it("rejects non-base32 chars (1, 8, 9, 0)", () => {
    // Base32 alphabet per RFC 4648 = [A-Z2-7]. Digits 0, 1, 8, 9 are
    // excluded (visually-ambiguous with O, I, B, g).
    expect(isValidLicenceShape("grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234560")).toBe(false);
    expect(isValidLicenceShape("grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234561")).toBe(false);
    expect(isValidLicenceShape("grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234568")).toBe(false);
    expect(isValidLicenceShape("grip-post-pro-ABCDEFGHIJKLMNOPQRSTUVWXYZ234569")).toBe(false);
  });
  it("accepts lowercase via normalisation", () => {
    expect(isValidLicenceShape("grip-post-pro-abcdefghijklmnopqrstuvwxyz234567")).toBe(true);
  });
  it("accepts surrounding whitespace via trim", () => {
    expect(isValidLicenceShape(`  ${VALID_KEY}  `)).toBe(true);
  });
});

describe("saveLicence → getLicence round-trip", () => {
  it("saves and reads back the canonical key", async () => {
    await saveLicence(VALID_KEY, storage);
    expect(await getLicence(storage)).toBe(VALID_KEY);
  });
  it("normalises lowercase input on save", async () => {
    const saved = await saveLicence(
      "grip-post-pro-abcdefghijklmnopqrstuvwxyz234567",
      storage,
    );
    expect(saved).toBe(VALID_KEY);
    expect(await getLicence(storage)).toBe(VALID_KEY);
  });
  it("throws on shape-invalid input", async () => {
    await expect(saveLicence("not-a-licence", storage)).rejects.toThrow(
      /Invalid licence key shape/,
    );
  });
  it("getLicence returns null when nothing stored", async () => {
    expect(await getLicence(storage)).toBeNull();
  });
});

describe("clearLicence", () => {
  it("removes the stored licence", async () => {
    await saveLicence(VALID_KEY, storage);
    await clearLicence(storage);
    expect(await getLicence(storage)).toBeNull();
  });
  it("is idempotent on empty storage", async () => {
    await clearLicence(storage);
    await clearLicence(storage);
    expect(await getLicence(storage)).toBeNull();
  });
});

describe("hasProLicence", () => {
  it("false on fresh storage", async () => {
    expect(await hasProLicence(storage)).toBe(false);
  });
  it("true after saving a valid key", async () => {
    await saveLicence(VALID_KEY, storage);
    expect(await hasProLicence(storage)).toBe(true);
  });
  it("false after clear", async () => {
    await saveLicence(VALID_KEY, storage);
    await clearLicence(storage);
    expect(await hasProLicence(storage)).toBe(false);
  });
});

describe("defensive read — corrupted storage", () => {
  it("returns null if storage was poisoned with non-string", async () => {
    await storage.set({ [LICENCE_KEY]: 42 });
    expect(await getLicence(storage)).toBeNull();
  });
  it("returns null if storage holds a shape-invalid string", async () => {
    // Directly write garbage bypassing saveLicence validation.
    await storage.set({ [LICENCE_KEY]: "not-valid" });
    expect(await getLicence(storage)).toBeNull();
  });
});

describe("adversarial — distinct outputs", () => {
  it("two different valid keys produce two different stored values", async () => {
    const s1 = inMemoryStorage();
    const s2 = inMemoryStorage();
    await saveLicence(VALID_KEY, s1);
    await saveLicence(
      "grip-post-pro-ZYXWVUTSRQPONMLKJIHGFEDCBA765432",
      s2,
    );
    expect(await getLicence(s1)).not.toBe(await getLicence(s2));
  });
});
