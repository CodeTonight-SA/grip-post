import { describe, it, expect } from "vitest";
import {
  normaliseRange,
  expandToLines,
  applyToRange,
  replaceRange,
  initHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  HISTORY_LIMIT,
  type Range,
  type History,
  type HistoryState,
} from "../src/lib/selection";
import { toBold } from "../src/lib/unicode-toolkit";

const upper = (s: string): string => s.toUpperCase();
const state = (text: string, start = 0, end = 0): HistoryState => ({
  text,
  selection: { start, end },
});

describe("normaliseRange", () => {
  const text = "hello world"; // length 11

  it("leaves an in-bounds, ordered range untouched", () => {
    expect(normaliseRange(text, { start: 2, end: 5 })).toEqual({ start: 2, end: 5 });
  });

  it("clamps an end past the text length down to the length", () => {
    expect(normaliseRange(text, { start: 6, end: 999 })).toEqual({ start: 6, end: 11 });
  });

  it("clamps a negative start up to 0", () => {
    expect(normaliseRange(text, { start: -5, end: 4 })).toEqual({ start: 0, end: 4 });
  });

  it("swaps an inverted range from a right-to-left drag", () => {
    expect(normaliseRange(text, { start: 8, end: 3 })).toEqual({ start: 3, end: 8 });
  });

  it("clamps both endpoints when both are out of bounds", () => {
    expect(normaliseRange(text, { start: -10, end: 50 })).toEqual({ start: 0, end: 11 });
  });

  it("swaps AND clamps an inverted out-of-bounds range", () => {
    expect(normaliseRange(text, { start: 99, end: -4 })).toEqual({ start: 0, end: 11 });
  });

  // The load-bearing decision, asserted rather than assumed.
  it("DECISION: a collapsed range means the whole document", () => {
    expect(normaliseRange(text, { start: 4, end: 4 })).toEqual({ start: 0, end: 11 });
  });

  it("DECISION: a collapsed range at position 0 also means the whole document", () => {
    expect(normaliseRange(text, { start: 0, end: 0 })).toEqual({ start: 0, end: 11 });
  });

  it("DECISION: a collapsed range at the very end also means the whole document", () => {
    expect(normaliseRange(text, { start: 11, end: 11 })).toEqual({ start: 0, end: 11 });
  });

  it("collapses to {0,0} on empty text, where whole-document is empty", () => {
    expect(normaliseRange("", { start: 0, end: 0 })).toEqual({ start: 0, end: 0 });
  });
});

describe("expandToLines", () => {
  // indices: a=0 \n=1 b=2 \n=3 c=4
  const three = "one\ntwo\nthree";
  // indices: o=0..2 \n=3 t=4..6 \n=7 t=8..12  (length 13)

  it("grows a mid-word range in the middle line to that whole line", () => {
    // "w" of "two" sits at index 5
    expect(expandToLines(three, { start: 5, end: 6 })).toEqual({ start: 4, end: 7 });
    expect(three.slice(4, 7)).toBe("two");
  });

  it("leaves a range already on line boundaries unchanged", () => {
    expect(expandToLines(three, { start: 4, end: 7 })).toEqual({ start: 4, end: 7 });
  });

  it("does NOT swallow the following line when the range ends exactly at a line break", () => {
    // {0,3} is "one"; index 3 IS the newline.
    const r = expandToLines(three, { start: 0, end: 3 });
    expect(r).toEqual({ start: 0, end: 3 });
    expect(three.slice(r.start, r.end)).toBe("one");
    expect(three.slice(r.start, r.end)).not.toContain("two");
  });

  it("expands a range spanning two lines to cover both whole lines", () => {
    // starts mid-"one", ends mid-"two"
    expect(expandToLines(three, { start: 1, end: 5 })).toEqual({ start: 0, end: 7 });
    expect(three.slice(0, 7)).toBe("one\ntwo");
  });

  it("reaches the end of text when the last line has no trailing newline", () => {
    expect(expandToLines(three, { start: 9, end: 10 })).toEqual({ start: 8, end: 13 });
    expect(three.slice(8, 13)).toBe("three");
  });

  it("returns the whole text for a single line with no newlines", () => {
    expect(expandToLines("just one line", { start: 2, end: 4 })).toEqual({
      start: 0,
      end: 13,
    });
  });

  it("keeps lineStart at 0 when the text opens with a newline", () => {
    // Guards the lastIndexOf(needle, -1) trap, which still probes index 0.
    const t = "\nsecond";
    expect(expandToLines(t, { start: 0, end: 0 }).start).toBe(0);
  });

  it("expands a collapsed range to whole lines via the whole-document rule", () => {
    expect(expandToLines(three, { start: 5, end: 5 })).toEqual({ start: 0, end: 13 });
  });
});

describe("applyToRange", () => {
  const text = "hello world";

  it("transforms only the selected slice and leaves the rest byte-identical", () => {
    const r = applyToRange(text, { start: 0, end: 5 }, upper);
    expect(r.text).toBe("HELLO world");
    expect(r.text.slice(5)).toBe(" world");
  });

  it("transforms a slice in the middle, leaving both sides intact", () => {
    const r = applyToRange("aaa bbb ccc", { start: 4, end: 7 }, upper);
    expect(r.text).toBe("aaa BBB ccc");
  });

  // The property that stops a second transform hitting the wrong span.
  it("returns a selection that re-slices to exactly fn(original slice)", () => {
    const r = applyToRange(text, { start: 0, end: 5 }, upper);
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe(upper("hello"));
  });

  it("keeps that property when the transform GROWS the text (astral bold)", () => {
    const r = applyToRange(text, { start: 0, end: 5 }, toBold);
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe(toBold("hello"));
    expect(r.text).toBe("\u{1D5F5}\u{1D5F2}\u{1D5F9}\u{1D5F9}\u{1D5FC} world");
    expect(r.text).toBe("𝗵𝗲𝗹𝗹𝗼 world");
    // 5 ASCII units became 10 UTF-16 units, so the end MUST have moved.
    expect(r.selection).toEqual({ start: 0, end: 10 });
  });

  it("keeps that property when the transform SHRINKS the text", () => {
    const drop = (s: string): string => s.replace(/l/g, "");
    const r = applyToRange(text, { start: 0, end: 5 }, drop);
    expect(r.text).toBe("heo world");
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe("heo");
    expect(r.selection).toEqual({ start: 0, end: 3 });
  });

  it("keeps that property when the transform empties the slice", () => {
    const r = applyToRange(text, { start: 0, end: 5 }, () => "");
    expect(r.text).toBe(" world");
    expect(r.selection).toEqual({ start: 0, end: 0 });
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe("");
  });

  it("transforms the whole document for a collapsed range", () => {
    const r = applyToRange(text, { start: 4, end: 4 }, upper);
    expect(r.text).toBe("HELLO WORLD");
    expect(r.selection).toEqual({ start: 0, end: 11 });
  });

  it("handles an inverted range identically to its ordered twin", () => {
    const inverted = applyToRange(text, { start: 5, end: 0 }, upper);
    const ordered = applyToRange(text, { start: 0, end: 5 }, upper);
    expect(inverted).toEqual(ordered);
  });

  it("does not mutate the input string", () => {
    const original = "hello world";
    applyToRange(original, { start: 0, end: 5 }, upper);
    expect(original).toBe("hello world");
  });

  it("is a no-op on text when fn is the identity", () => {
    const r = applyToRange(text, { start: 2, end: 7 }, (s) => s);
    expect(r.text).toBe(text);
  });
});

describe("applyToRange — UTF-16 offsets with astral characters", () => {
  // textarea.selectionStart reports UTF-16 units, so an emoji before the
  // selection occupies TWO of them. Offsets must still line up.
  const text = "🎉 hello world";

  it("confirms the emoji is two UTF-16 units, so 'hello' starts at index 3", () => {
    expect("🎉".length).toBe(2);
    expect(text.indexOf("hello")).toBe(3);
    expect(text.slice(3, 8)).toBe("hello");
  });

  it("transforms the word after an emoji without disturbing the emoji", () => {
    const r = applyToRange(text, { start: 3, end: 8 }, upper);
    expect(r.text).toBe("🎉 HELLO world");
    expect(r.text.startsWith("🎉")).toBe(true);
  });

  it("returns offsets that re-slice correctly past a leading emoji", () => {
    const r = applyToRange(text, { start: 3, end: 8 }, toBold);
    expect(r.text).toBe("🎉 𝗵𝗲𝗹𝗹𝗼 world");
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe(toBold("hello"));
    expect(r.selection).toEqual({ start: 3, end: 13 });
  });

  it("survives an emoji INSIDE the transformed slice", () => {
    const t = "say 🎉 now";
    const r = applyToRange(t, { start: 4, end: 6 }, (s) => `[${s}]`);
    expect(r.text).toBe("say [🎉] now");
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe("[🎉]");
  });
});

describe("replaceRange", () => {
  const text = "hello world";

  it("replaces just the selected slice", () => {
    const r = replaceRange(text, { start: 6, end: 11 }, "there");
    expect(r.text).toBe("hello there");
  });

  it("returns a selection covering exactly the replacement", () => {
    const r = replaceRange(text, { start: 6, end: 11 }, "everyone");
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe("everyone");
    expect(r.selection).toEqual({ start: 6, end: 14 });
  });

  it("replaces the whole document for a collapsed range, per the module-wide rule", () => {
    const r = replaceRange(text, { start: 3, end: 3 }, "gone");
    expect(r.text).toBe("gone");
    expect(r.selection).toEqual({ start: 0, end: 4 });
  });

  it("can delete a slice by replacing it with an empty string", () => {
    const r = replaceRange(text, { start: 5, end: 11 }, "");
    expect(r.text).toBe("hello");
    expect(r.selection).toEqual({ start: 5, end: 5 });
  });
});

describe("History — construction and predicates", () => {
  it("starts with nothing to undo and nothing to redo", () => {
    const h = initHistory(state("a"));
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toEqual(state("a"));
    expect(h.past).toEqual([]);
    expect(h.future).toEqual([]);
  });

  it("can undo after one push", () => {
    const h = pushHistory(initHistory(state("a")), state("b"));
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
    expect(h.present.text).toBe("b");
  });

  it("can redo after an undo", () => {
    const h = undo(pushHistory(initHistory(state("a")), state("b")));
    expect(canRedo(h)).toBe(true);
    expect(h.present.text).toBe("a");
  });
});

describe("History — undo/redo semantics", () => {
  it("returns the history unchanged when undoing an empty past", () => {
    const h = initHistory(state("a"));
    expect(undo(h)).toBe(h);
  });

  it("returns the history unchanged when redoing an empty future", () => {
    const h = initHistory(state("a"));
    expect(redo(h)).toBe(h);
  });

  it("survives repeated undo past the bottom of the stack", () => {
    let h = pushHistory(initHistory(state("a")), state("b"));
    for (let i = 0; i < 10; i += 1) h = undo(h);
    expect(h.present).toEqual(state("a"));
    expect(h.past).toEqual([]);
  });

  it("round-trips undo then redo back to the same present", () => {
    const pushed = pushHistory(initHistory(state("a")), state("b"));
    const round = redo(undo(pushed));
    expect(round.present).toEqual(pushed.present);
    expect(round.past).toEqual(pushed.past);
    expect(round.future).toEqual([]);
  });

  it("clears the future when a new state is pushed after an undo", () => {
    const h = undo(pushHistory(initHistory(state("a")), state("b")));
    expect(canRedo(h)).toBe(true);
    const branched = pushHistory(h, state("c"));
    expect(branched.future).toEqual([]);
    expect(canRedo(branched)).toBe(false);
    expect(branched.present.text).toBe("c");
  });

  it("preserves the selection alongside the text in each snapshot", () => {
    const h = pushHistory(initHistory(state("a", 1, 2)), state("b", 3, 4));
    expect(undo(h).present.selection).toEqual({ start: 1, end: 2 });
  });

  it("does not mutate the history it is given", () => {
    const h = initHistory(state("a"));
    pushHistory(h, state("b"));
    expect(h.past).toEqual([]);
    expect(h.present.text).toBe("a");
  });
});

describe("History — N pushes then N undos", () => {
  /** Build a history of `n` sequential pushes from a labelled initial state. */
  const build = (n: number): { start: History; end: History } => {
    const first = initHistory(state("state-0"));
    let h = first;
    for (let i = 1; i <= n; i += 1) h = pushHistory(h, state(`state-${i}`));
    return { start: first, end: h };
  };

  /** Apply `undo` `n` times. */
  const undoTimes = (h: History, n: number): History => {
    let out = h;
    for (let i = 0; i < n; i += 1) out = undo(out);
    return out;
  };

  it("N=1: returns exactly the initial state", () => {
    const { start, end } = build(1);
    const h = undoTimes(end, 1);
    expect(h.present).toEqual(start.present);
    expect(h.past).toEqual([]);
  });

  it("N=5: returns exactly the initial state", () => {
    const { start, end } = build(5);
    const h = undoTimes(end, 5);
    expect(h.present).toEqual(start.present);
    expect(h.past).toEqual([]);
  });

  it("N=60: the cap is LOSSY — undoing all the way lands on the oldest RETAINED state", () => {
    const { start, end } = build(60);
    expect(end.past).toHaveLength(HISTORY_LIMIT);
    const oldestRetained = end.past[0];

    const h = undoTimes(end, 60);

    expect(h.present).toEqual(oldestRetained);
    // Honest about the loss: this is NOT the initial state.
    expect(h.present).not.toEqual(start.present);
    // 60 pushes, 50 retained, so the 10 oldest were dropped.
    expect(h.present.text).toBe("state-10");
  });
});

describe("History — the cap", () => {
  it("never lets the past exceed the default limit", () => {
    let h = initHistory(state("s0"));
    for (let i = 1; i <= 200; i += 1) h = pushHistory(h, state(`s${i}`));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });

  it("drops the OLDEST entry, keeping the most recent steps", () => {
    let h = initHistory(state("s0"));
    for (let i = 1; i <= 4; i += 1) h = pushHistory(h, state(`s${i}`), 2);
    expect(h.past.map((s) => s.text)).toEqual(["s2", "s3"]);
  });

  it("honours a custom limit", () => {
    let h = initHistory(state("s0"));
    for (let i = 1; i <= 10; i += 1) h = pushHistory(h, state(`s${i}`), 3);
    expect(h.past).toHaveLength(3);
  });

  it("retains nothing at limit 0, where slice(-0) would silently retain everything", () => {
    let h = initHistory(state("s0"));
    for (let i = 1; i <= 5; i += 1) h = pushHistory(h, state(`s${i}`), 0);
    expect(h.past).toEqual([]);
    expect(canUndo(h)).toBe(false);
  });

  it("retains nothing at a negative limit", () => {
    const h = pushHistory(initHistory(state("s0")), state("s1"), -3);
    expect(h.past).toEqual([]);
  });

  it("defaults the limit to HISTORY_LIMIT of 50", () => {
    expect(HISTORY_LIMIT).toBe(50);
  });
});

describe("the user's actual complaint", () => {
  // "I selected one sentence and clicked a button, and it transformed my
  // ENTIRE post." Encoded as a test: the untouched paragraphs must come out
  // byte-identical.
  const first = "We shipped the selection fix today.";
  const middle = "The whole textarea used to get transformed.";
  const last = "Now only what you select changes.";
  const post = `${first}\n\n${middle}\n\n${last}`;

  const selection: Range = {
    start: post.indexOf(middle),
    end: post.indexOf(middle) + middle.length,
  };

  it("uppercases only the middle paragraph", () => {
    const r = applyToRange(post, selection, upper);
    expect(r.text).toBe(`${first}\n\n${middle.toUpperCase()}\n\n${last}`);
  });

  it("leaves the first and last paragraphs byte-identical", () => {
    const r = applyToRange(post, selection, upper);
    const paragraphs = r.text.split("\n\n");
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toBe(first);
    expect(paragraphs[2]).toBe(last);
  });

  it("bolds only the middle paragraph, leaving the others untouched", () => {
    const r = applyToRange(post, selection, toBold);
    const paragraphs = r.text.split("\n\n");
    expect(paragraphs[0]).toBe(first);
    expect(paragraphs[1]).toBe(toBold(middle));
    expect(paragraphs[2]).toBe(last);
  });

  it("returns a selection still sitting on the middle paragraph after bolding", () => {
    const r = applyToRange(post, selection, toBold);
    expect(r.text.slice(r.selection.start, r.selection.end)).toBe(toBold(middle));
  });

  it("still transforms the whole post when nothing is selected", () => {
    // The existing behaviour every current user relies on.
    const caret: Range = { start: 12, end: 12 };
    const r = applyToRange(post, caret, upper);
    expect(r.text).toBe(post.toUpperCase());
  });

  it("bolds a single selected word without touching its neighbours", () => {
    const start = post.indexOf("selection");
    const r = applyToRange(post, { start, end: start + "selection".length }, toBold);
    expect(r.text).toContain("We shipped the 𝘀𝗲𝗹𝗲𝗰𝘁𝗶𝗼𝗻 fix today.");
    expect(r.text).toContain(last);
  });
});
