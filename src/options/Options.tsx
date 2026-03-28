import { useEffect, useState } from "react";
import { loadConfig, saveConfig } from "@/lib/storage";
import { testConnection } from "@/lib/api";
import { t, useI18n, setLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

type TestStatus = "idle" | "testing" | "success" | "error";

export function Options() {
  useI18n();
  const [hostUrl, setHostUrl] = useState("");
  const [token, setToken] = useState("");
  const [defaultTags, setDefaultTags] = useState("#webclipper");
  const [defaultVisibility, setDefaultVisibility] = useState<"PRIVATE" | "PROTECTED" | "PUBLIC">(
    "PRIVATE",
  );
  const [locale, setLocaleState] = useState<Locale>("auto");
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");

  useEffect(() => {
    loadConfig().then((cfg) => {
      setHostUrl(cfg.hostUrl);
      setToken(cfg.token);
      setDefaultTags(cfg.defaultTags);
      setDefaultVisibility(cfg.defaultVisibility);
      setLocaleState(cfg.locale);
    });
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocaleState(newLocale);
    setLocale(newLocale);
  };

  const handleSave = async () => {
    await saveConfig({
      hostUrl: hostUrl.replace(/\/+$/, ""),
      token,
      defaultTags,
      defaultVisibility,
      locale,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!hostUrl || !token) return;
    setTestStatus("testing");
    try {
      const ok = await testConnection(hostUrl.replace(/\/+$/, ""), token);
      setTestStatus(ok ? "success" : "error");
    } catch {
      setTestStatus("error");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-8 text-lg font-semibold text-foreground">{t("optionsTitle")}</h1>

      <div className="space-y-5">
        <Field label={t("memosUrl")} hint={t("memosUrlHint")}>
          <input
            type="url"
            value={hostUrl}
            onChange={(e) => setHostUrl(e.target.value)}
            placeholder="https://memos.example.com"
            className="field-input"
          />
        </Field>

        <Field label={t("accessToken")} hint={t("accessTokenHint")}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="memos_pat_..."
            className="field-input"
          />
        </Field>

        <Field label={t("defaultTags")} hint={t("defaultTagsHint")}>
          <input
            type="text"
            value={defaultTags}
            onChange={(e) => setDefaultTags(e.target.value)}
            placeholder="#webclipper"
            className="field-input"
          />
        </Field>

        <Field label={t("defaultVisibility")}>
          <select
            value={defaultVisibility}
            onChange={(e) =>
              setDefaultVisibility(e.target.value as "PRIVATE" | "PROTECTED" | "PUBLIC")
            }
            className="field-input"
          >
            <option value="PRIVATE">{t("visibilityPrivate")}</option>
            <option value="PROTECTED">{t("visibilityProtected")}</option>
            <option value="PUBLIC">{t("visibilityPublic")}</option>
          </select>
        </Field>

        <Field label={t("language")}>
          <select
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value as Locale)}
            className="field-input"
          >
            <option value="auto">{t("languageAuto")}</option>
            <option value="en">English</option>
            <option value="zh_CN">简体中文</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
          >
            {saved ? t("settingsSaved") : t("saveSettings")}
          </button>
          <button
            onClick={handleTest}
            disabled={!hostUrl || !token || testStatus === "testing"}
            className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
              testStatus === "success"
                ? "border-green-300 bg-green-50 text-green-700"
                : testStatus === "error"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            {testStatus === "testing"
              ? t("testing")
              : testStatus === "success"
                ? t("testSuccess")
                : testStatus === "error"
                  ? t("testFailed")
                  : t("testConnection")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
