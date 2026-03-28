import { useEffect, useState } from "react";
import type { Locale } from "./types";
import en from "../../public/_locales/en/messages.json";
import zh_CN from "../../public/_locales/zh_CN/messages.json";
import ja from "../../public/_locales/ja/messages.json";
import ko from "../../public/_locales/ko/messages.json";

type MessageKey = keyof typeof en;

interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

const bundles: Record<string, Record<string, MessageEntry>> = { en, zh_CN, ja, ko };

let currentLocale: Locale = "auto";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * React hook: reads locale from storage on mount, sets it, and triggers
 * a re-render so all `t()` calls in the component tree pick up the locale.
 */
export function useI18n() {
  const [, bump] = useState(0);
  useEffect(() => {
    chrome.storage.sync.get("memos_clipper_config").then((result) => {
      const locale: Locale = result.memos_clipper_config?.locale || "auto";
      if (locale !== currentLocale) {
        currentLocale = locale;
        bump((n) => n + 1);
      }
    });
  }, []);
}

export function t(key: MessageKey, ...substitutions: string[]): string {
  if (currentLocale === "auto") {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  const bundle = bundles[currentLocale];
  if (!bundle?.[key]) return chrome.i18n.getMessage(key, substitutions) || key;

  return resolveMessage(bundle[key], substitutions);
}

function resolveMessage(entry: MessageEntry, substitutions: string[]): string {
  let msg = entry.message;
  if (entry.placeholders) {
    for (const [name, ph] of Object.entries(entry.placeholders)) {
      const value = ph.content.replace(
        /\$(\d+)/g,
        (_, n) => substitutions[parseInt(n) - 1] || "",
      );
      msg = msg.replace(new RegExp(`\\$${name}\\$`, "gi"), value);
    }
  }
  return msg;
}
