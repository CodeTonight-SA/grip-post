// grip-post service worker — context menu items + side panel opener.
// Context-menu clicks forward the selection + key to the content script,
// which applies the transform via the shared dispatch and writes the
// result to the clipboard. Background never touches the page DOM.

import type { TransformKey } from "./lib/unicode-toolkit";

interface MenuItem {
  readonly id: TransformKey;
  readonly title: string;
}

const MENU_ITEMS: readonly MenuItem[] = [
  { id: "bold", title: "grip-post: 𝗕𝗼𝗹𝗱" },
  { id: "italic", title: "grip-post: 𝘐𝘵𝘢𝘭𝘪𝘤" },
  { id: "brackets", title: "grip-post: ⌜ Brackets ⌟" },
  { id: "hr", title: "grip-post: ━━━ Horizontal" },
  { id: "arrow", title: "grip-post: ▸  ─→  Arrow bullet" },
  { id: "handles", title: "grip-post: A.com · B.com (Handles)" },
  { id: "diamond", title: "grip-post: Diamond ◆" },
];

chrome.runtime.onInstalled.addListener(() => {
  for (const item of MENU_ITEMS) {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: ["selection"],
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !info.selectionText) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "transform",
    transform: info.menuItemId as TransformKey,
    text: info.selectionText,
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
