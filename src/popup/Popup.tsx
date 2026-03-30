import { useCallback, useEffect, useRef, useState } from "react";
import { loadConfig } from "@/lib/storage";
import { createMemo, getContentLengthLimit, uploadAttachment } from "@/lib/api";
import { formatMemoContent } from "@/lib/formatter";
import { clipActiveTab, ClipError } from "@/lib/clipper";
import { t, useI18n } from "@/lib/i18n";
import type { ClipData, ExtensionConfig, PendingClip, UploadedAttachment } from "@/lib/types";

type SaveStatus = "idle" | "saving" | "success" | "error" | "truncated";

export function Popup() {
  useI18n();
  const [thought, setThought] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const [clipData, setClipData] = useState<ClipData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [tags, setTags] = useState("");
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [selectionText, setSelectionText] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg);
      setTags(cfg.defaultTags);
    });

    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        setPageTitle(tab.title || "");
        setPageUrl(tab.url || "");
      }
    });

    chrome.storage.session.get("pendingClip").then((result) => {
      const clip = result.pendingClip as PendingClip | undefined;
      if (clip?.type === "selection" && clip.text) {
        setSelectionText(clip.text);
        setPageUrl(clip.url || "");
        setPageTitle(clip.title || "");
        chrome.storage.session.remove("pendingClip");
      }
    });

    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const extractContent = useCallback(async () => {
    setExtracting(true);
    setExtractError("");
    try {
      const result = await clipActiveTab();
      setClipData(result.data);
      if (!pageUrl) setPageUrl(result.pageUrl);
      if (!pageTitle) setPageTitle(result.pageTitle);
    } catch (err) {
      const msg =
        err instanceof ClipError
          ? t(err.messageKey as Parameters<typeof t>[0])
          : err instanceof Error
            ? err.message
            : t("errExtractFailed");
      setExtractError(msg);
      setClipData(null);
    } finally {
      setExtracting(false);
    }
  }, [pageUrl, pageTitle]);

  useEffect(() => {
    if (includeContent && !clipData && !extracting) {
      extractContent();
    }
  }, [includeContent, clipData, extracting, extractContent]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !config?.hostUrl || !config?.token) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadAttachment(config.hostUrl, config.token, file);
        setAttachments((prev) => [...prev, attachment]);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("errUploadFailed"));
      setSaveStatus("error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  const canSave =
    config?.hostUrl &&
    config?.token &&
    (thought.trim() || selectionText.trim() || (includeContent && clipData) || attachments.length > 0);

  const handleSave = async () => {
    if (!config?.hostUrl || !config?.token) return;
    setSaveStatus("saving");
    setSaveError("");
    try {
      const limit = await getContentLengthLimit(config.hostUrl, config.token);
      const { content, truncated } = formatMemoContent(
        { thought, tags, includeContent, clipData, selectionText, pageTitle, pageUrl },
        limit,
      );
      await createMemo(
        config.hostUrl,
        config.token,
        content,
        config.defaultVisibility,
        attachments.length > 0 ? attachments : undefined,
      );
      setSaveStatus(truncated ? "truncated" : "success");
      setTimeout(() => window.close(), truncated ? 2000 : 800);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : t("errSaveFailed"));
    }
  };

  const configMissing = config && (!config.hostUrl || !config.token);

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h1 className="text-sm font-semibold text-foreground">Memos Web Clipper</h1>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title={t("settings")}
        >
          <IconSettings />
        </button>
      </div>

      {/* Config missing warning */}
      {configMissing && (
        <ConfigMissingBanner />
      )}

      {/* Editor card */}
      <div className="flex flex-col rounded-lg border border-border bg-card">
        {/* Selection text preview */}
        {selectionText && (
          <div className="mx-3 mt-3 rounded-md bg-secondary px-3 py-2">
            <div className="mb-1 text-xs text-muted-foreground">{t("selectedText")}</div>
            <div className="max-h-24 overflow-y-auto text-xs text-secondary-foreground leading-relaxed whitespace-pre-wrap">
              {selectionText}
            </div>
            {pageTitle && (
              <div className="mt-1.5 truncate text-xs text-muted-foreground">
                — {pageTitle}
              </div>
            )}
          </div>
        )}

        {/* Web content info */}
        {includeContent && (
          <div className="mx-3 mt-3 rounded-md bg-secondary px-3 py-2">
            {extracting && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <IconSpinner />
                {t("extracting")}
              </div>
            )}
            {extractError && <div className="text-xs text-destructive">{extractError}</div>}
            {clipData && (
              <div className="space-y-0.5">
                <div className="truncate text-xs font-medium text-foreground">{clipData.title}</div>
                <div className="truncate text-xs text-muted-foreground">{pageUrl}</div>
                <div className="text-xs text-primary">{t("extracted")} ({formatBytes(clipData.byteLength)})</div>
              </div>
            )}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          placeholder={t("thoughtPlaceholder")}
          rows={4}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        />

        {/* Uploaded files */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {attachments.map((a) => (
              <span
                key={a.name}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                <IconFile />
                <span className="max-w-[120px] truncate">{a.filename}</span>
                <button
                  onClick={() => removeAttachment(a.name)}
                  className="ml-0.5 rounded text-muted-foreground hover:text-destructive"
                >
                  <IconX />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Toolbar separator */}
        <div className="border-t border-border" />

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 py-1.5">
          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !config?.hostUrl || !config?.token}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
            title={t("uploadFile")}
          >
            {uploading ? <IconSpinner /> : <IconPaperclip />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Web clip toggle */}
          <button
            onClick={() => {
              const next = !includeContent;
              setIncludeContent(next);
              if (!next) {
                setClipData(null);
                setExtractError("");
              }
            }}
            className={`rounded-md p-1.5 transition-colors ${
              includeContent
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            title={includeContent ? t("webContentOn") : t("webContentOff")}
          >
            <IconGlobe />
          </button>

          {/* Tags */}
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t("tagPlaceholder")}
            className="mx-1 min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
          />

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!canSave || saveStatus === "saving"}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
              saveStatus === "success" || saveStatus === "truncated"
                ? "bg-green-600 text-white"
                : saveStatus === "error"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-40"
            }`}
          >
            {saveStatus === "saving"
              ? t("saving")
              : saveStatus === "success"
                ? t("saved")
                : saveStatus === "truncated"
                  ? t("savedTruncated")
                  : saveStatus === "error"
                    ? t("retry")
                    : t("save")}
          </button>
        </div>
      </div>

      {/* Error detail */}
      {saveStatus === "error" && saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 break-all">
          {saveError}
        </div>
      )}
    </div>
  );
}

function ConfigMissingBanner() {
  const marker = "\x00";
  const msg = t("configMissing", marker);
  const parts = msg.split(marker);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
      {parts[0]}
      <button onClick={() => chrome.runtime.openOptionsPage()} className="underline">
        {t("configMissingLink")}
      </button>
      {parts[1]}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function IconSettings() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7 7 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7 7 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a7 7 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7 7 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </svg>
  );
}

function IconPaperclip() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
      />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A12 12 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.96 8.96 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.47.353-2.856.978-4.08"
      />
    </svg>
  );
}

function IconFile() {
  return (
    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z"
      />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
