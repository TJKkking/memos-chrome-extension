const MENU_ID = "memos-clip-selection";

async function getMenuTitle() {
  try {
    const result = await chrome.storage.sync.get("memos_clipper_config");
    const locale = result.memos_clipper_config?.locale;
    if (!locale || locale === "auto") {
      return chrome.i18n.getMessage("contextMenuSendSelection");
    }
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const res = await fetch(url);
    const messages = await res.json();
    return messages.contextMenuSendSelection?.message || chrome.i18n.getMessage("contextMenuSendSelection");
  } catch {
    return chrome.i18n.getMessage("contextMenuSendSelection");
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }

  const title = await getMenuTitle();
  chrome.contextMenus.create({
    id: MENU_ID,
    title,
    contexts: ["selection"],
  });
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync" || !changes.memos_clipper_config) return;
  const oldLocale = changes.memos_clipper_config.oldValue?.locale;
  const newLocale = changes.memos_clipper_config.newValue?.locale;
  if (oldLocale === newLocale) return;

  const title = await getMenuTitle();
  chrome.contextMenus.update(MENU_ID, { title });
});

function getSelectionText() {
  try {
    const active = document.activeElement;
    const isTextInput =
      active &&
      (active.tagName === "TEXTAREA" ||
        (active.tagName === "INPUT" &&
          /^(text|search|url|tel|email|password)$/i.test(active.type || "text")));
    if (
      isTextInput &&
      typeof active.selectionStart === "number" &&
      typeof active.selectionEnd === "number"
    ) {
      return String(active.value || "")
        .slice(active.selectionStart, active.selectionEnd)
        .replace(/\r\n?/g, "\n");
    }
    const sel = window.getSelection();
    return sel ? String(sel.toString()).replace(/\r\n?/g, "\n") : "";
  } catch (_) {
    return "";
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  let selectionText = info.selectionText || "";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getSelectionText,
    });
    if (results?.[0]?.result) {
      selectionText = results[0].result;
    }
  } catch (_) {
    // Fallback to info.selectionText
  }

  if (!selectionText) return;

  await chrome.storage.session.set({
    pendingClip: {
      type: "selection",
      text: selectionText,
      url: info.pageUrl || tab.url || "",
      title: tab.title || "",
    },
  });

  try {
    await chrome.action.openPopup();
  } catch (_) {
    chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 420,
      height: 520,
    });
  }
});
