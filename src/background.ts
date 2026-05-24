// grip-post service worker
// Registers context menu items and opens side panel on action click.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "grip-post-format",
    title: "Format with grip-post",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "grip-post-check",
    title: "Check for fluff",
    contexts: ["selection"],
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});
