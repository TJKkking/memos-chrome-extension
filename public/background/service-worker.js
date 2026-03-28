chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }

  chrome.contextMenus.create({
    id: "memos-clip-selection",
    title: "发送选中文本到 Memos",
    contexts: ["selection"],
  });
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
  if (info.menuItemId !== "memos-clip-selection" || !tab?.id) return;

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
