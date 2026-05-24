// grip-post content script — receives transform messages from the background
// service worker, applies the shared dispatch, writes the result to the
// clipboard. Never mutates the page DOM — the user pastes the clipboard
// themselves, so LinkedIn's composer treats it as ordinary keyboard input
// and cannot block the extension's effect.

import { dispatch, type TransformKey } from "./lib/unicode-toolkit";

interface TransformMessage {
  readonly type: "transform";
  readonly transform: TransformKey;
  readonly text: string;
}

function isTransformMessage(msg: unknown): msg is TransformMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return (
    m.type === "transform" &&
    typeof m.transform === "string" &&
    typeof m.text === "string"
  );
}

chrome.runtime.onMessage.addListener((msg: unknown) => {
  if (!isTransformMessage(msg)) return;
  const result = dispatch(msg.transform, msg.text);
  void navigator.clipboard.writeText(result);
});

console.debug("[grip-post] content script loaded");
