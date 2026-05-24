// grip-post side panel — delegates to the shared dispatch in unicode-toolkit.
// Click handler is event-delegated on the document, so adding a new button in
// the HTML with `data-transform="..."` is the only change needed for a new key.

import { dispatch, type TransformKey } from "./lib/unicode-toolkit";

const input = document.getElementById("input") as HTMLTextAreaElement | null;
const output = document.getElementById("output") as HTMLElement | null;

const VALID_KEYS: ReadonlySet<TransformKey> = new Set<TransformKey>([
  "bold",
  "italic",
  "brackets",
  "hr",
  "arrow",
  "handles",
  "diamond",
]);

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const raw = target?.dataset?.transform;
  if (!raw || !VALID_KEYS.has(raw as TransformKey)) return;
  const text = input?.value ?? "";
  const result = dispatch(raw as TransformKey, text);
  if (output) output.textContent = result;
});
