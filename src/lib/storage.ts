import type { ExtensionConfig } from "./types";

const STORAGE_KEY = "memos_clipper_config";

const DEFAULT_CONFIG: ExtensionConfig = {
  hostUrl: "",
  token: "",
  defaultTags: "#webclipper",
  defaultVisibility: "PRIVATE",
};

export async function loadConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return { ...DEFAULT_CONFIG, ...result[STORAGE_KEY] };
}

export async function saveConfig(config: ExtensionConfig): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}
