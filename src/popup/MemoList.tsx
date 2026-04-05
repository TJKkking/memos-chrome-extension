import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  useMemo,
} from "react";
import { listMemos, deleteMemo, updateMemoPinned } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { ExtensionConfig, MemoItem } from "@/lib/types";

const PAGE_SIZE = 10;

export interface MemoListHandle {
  refresh: () => void;
}

interface MemoListProps {
  config: ExtensionConfig;
}

export const MemoList = forwardRef<MemoListHandle, MemoListProps>(
  function MemoList({ config }, ref) {
    const [memos, setMemos] = useState<MemoItem[]>([]);
    const [nextPageToken, setNextPageToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef(false);

    const fetchMemos = useCallback(
      async (pageToken?: string) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError("");
        try {
          const res = await listMemos(config.hostUrl, config.token, PAGE_SIZE, pageToken);
          if (pageToken) {
            setMemos((prev) => [...prev, ...res.memos]);
          } else {
            setMemos(res.memos);
          }
          setNextPageToken(res.nextPageToken);
        } catch (err) {
          setError(err instanceof Error ? err.message : t("loadMoreFailed"));
        } finally {
          setLoading(false);
          setInitialLoading(false);
          loadingRef.current = false;
        }
      },
      [config.hostUrl, config.token],
    );

    const refresh = useCallback(() => {
      setNextPageToken("");
      fetchMemos();
    }, [fetchMemos]);

    useEffect(() => {
      fetchMemos();
    }, [fetchMemos]);

    useImperativeHandle(ref, () => ({ refresh }));

    const handleScroll = useCallback(() => {
      const el = containerRef.current;
      if (!el || !nextPageToken || loadingRef.current) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
        fetchMemos(nextPageToken);
      }
    }, [nextPageToken, fetchMemos]);

    const handleDelete = useCallback(
      async (memo: MemoItem) => {
        try {
          await deleteMemo(config.hostUrl, config.token, memo.name);
          setMemos((prev) => prev.filter((m) => m.name !== memo.name));
        } catch {
          setError(t("errDeleteFailed"));
        }
      },
      [config.hostUrl, config.token],
    );

    const handleTogglePin = useCallback(
      async (memo: MemoItem) => {
        try {
          await updateMemoPinned(config.hostUrl, config.token, memo.name, !memo.pinned);
          refresh();
        } catch {
          setError(t("errPinFailed"));
        }
      },
      [config.hostUrl, config.token, refresh],
    );

    const openMemo = useCallback(
      (memo: MemoItem) => {
        const url = `${config.hostUrl.replace(/\/+$/, "")}/${memo.name}`;
        chrome.tabs.create({ url });
      },
      [config.hostUrl],
    );

    if (!config.hostUrl || !config.token) return null;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-medium text-muted-foreground">{t("recentMemos")}</h2>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex max-h-[280px] flex-col gap-1 overflow-y-auto"
        >
          {initialLoading && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <LoadingSpinner />
              <span className="ml-2">{t("loadingMemos")}</span>
            </div>
          )}

          {!initialLoading && memos.length === 0 && !error && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t("noMemos")}
            </div>
          )}

          {!initialLoading && error && memos.length === 0 && (
            <button
              onClick={() => fetchMemos()}
              className="py-6 text-center text-xs text-destructive hover:underline"
            >
              {t("loadMoreFailed")}
            </button>
          )}

          {memos.map((memo) => (
            <MemoCard
              key={memo.name}
              memo={memo}
              onOpen={() => openMemo(memo)}
              onDelete={() => handleDelete(memo)}
              onTogglePin={() => handleTogglePin(memo)}
            />
          ))}

          {loading && !initialLoading && (
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
              <LoadingSpinner />
            </div>
          )}

          {!loading && error && memos.length > 0 && (
            <button
              onClick={() => fetchMemos(nextPageToken)}
              className="py-2 text-center text-xs text-destructive hover:underline"
            >
              {t("loadMoreFailed")}
            </button>
          )}
        </div>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------

interface MemoCardProps {
  memo: MemoItem;
  onOpen: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function MemoCard({ memo, onOpen, onDelete, onTogglePin }: MemoCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(memo.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      onDelete();
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  const formattedTime = useMemo(
    () => formatDetailedTime(memo.displayTime || memo.createTime),
    [memo.displayTime, memo.createTime],
  );

  const renderedContent = useMemo(
    () => renderMarkdown(memo.content.slice(0, 500)),
    [memo.content],
  );

  return (
    <div className="group relative flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-secondary/30">
      {/* Row 1: time (left) + hover action buttons (right) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {memo.pinned && (
            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
              <IconPin />
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{formattedTime}</span>
        </div>

        {/* Hover action buttons */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={copied ? t("copied") : t("copyContent")}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>

          <button
            onClick={onTogglePin}
            className={`rounded p-1 transition-colors ${
              memo.pinned
                ? "text-primary hover:bg-secondary hover:text-primary/80"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            title={memo.pinned ? t("unpinMemo") : t("pinMemo")}
          >
            <IconPin />
          </button>

          <button
            onClick={handleDeleteClick}
            className={`rounded p-1 transition-colors ${
              confirmingDelete
                ? "text-destructive hover:bg-red-100"
                : "text-muted-foreground hover:bg-secondary hover:text-destructive"
            }`}
            title={confirmingDelete ? t("confirmDelete") : t("deleteMemo")}
          >
            <IconTrash />
          </button>

          <button
            onClick={onOpen}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title={t("openInMemos")}
          >
            <IconExternalLink />
          </button>
        </div>
      </div>

      {/* Row 2: content with markdown rendering */}
      <div
        className="memo-content line-clamp-6 text-xs leading-relaxed text-foreground/80"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />

      {/* Row 3: tags (bottom-left) */}
      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {memo.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown → HTML (no external deps, line-by-line processing)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const outputLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList: "ul" | "ol" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // fenced code blocks
    if (raw.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        outputLines.push(
          `<code class="memo-code-block">${escapeHtml(codeBlockContent.join("\n"))}</code>`,
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        if (inList) { outputLines.push(inList === "ul" ? "</ul>" : "</ol>"); inList = null; }
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockContent.push(raw);
      continue;
    }

    const trimmed = raw.trimStart();

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      if (inList) { outputLines.push(inList === "ul" ? "</ul>" : "</ol>"); inList = null; }
      outputLines.push('<hr class="memo-hr"/>');
      continue;
    }

    // headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { outputLines.push(inList === "ul" ? "</ul>" : "</ol>"); inList = null; }
      const level = headingMatch[1].length;
      outputLines.push(`<h${level} class="memo-h">${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // blockquote
    if (trimmed.startsWith("> ")) {
      if (inList) { outputLines.push(inList === "ul" ? "</ul>" : "</ol>"); inList = null; }
      outputLines.push(`<blockquote class="memo-blockquote">${renderInline(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // task list: - [ ] or - [x]
    const taskMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      if (inList !== "ul") {
        if (inList) outputLines.push("</ol>");
        outputLines.push('<ul class="memo-list">');
        inList = "ul";
      }
      const checked = taskMatch[1] !== " ";
      const checkHtml = checked
        ? '<span class="memo-checkbox checked">&#9745;</span>'
        : '<span class="memo-checkbox">&#9744;</span>';
      outputLines.push(`<li>${checkHtml} ${renderInline(taskMatch[2])}</li>`);
      continue;
    }

    // unordered list
    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (inList !== "ul") {
        if (inList) outputLines.push("</ol>");
        outputLines.push('<ul class="memo-list">');
        inList = "ul";
      }
      outputLines.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // ordered list
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (inList !== "ol") {
        if (inList) outputLines.push("</ul>");
        outputLines.push('<ol class="memo-list memo-ol">');
        inList = "ol";
      }
      outputLines.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    // close any open list when encountering a non-list line
    if (inList) {
      outputLines.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }

    // empty line → spacing
    if (trimmed === "") {
      outputLines.push("<br/>");
      continue;
    }

    // regular paragraph
    outputLines.push(`<span>${renderInline(trimmed)}</span>`);
  }

  // close unclosed blocks
  if (inCodeBlock && codeBlockContent.length > 0) {
    outputLines.push(
      `<code class="memo-code-block">${escapeHtml(codeBlockContent.join("\n"))}</code>`,
    );
  }
  if (inList) {
    outputLines.push(inList === "ul" ? "</ul>" : "</ol>");
  }

  return outputLines.join("");
}

function renderInline(text: string): string {
  let html = escapeHtml(text);

  // inline code (before other inline transforms)
  html = html.replace(/`([^`]+)`/g, '<code class="memo-code-inline">$1</code>');

  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // italic (single *)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // images ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    '<img class="memo-img" src="$2" alt="$1"/>',
  );

  // links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a class="memo-link" href="$2" target="_blank" rel="noopener">$1</a>',
  );

  // bare urls (not already inside href or anchor)
  html = html.replace(
    /(?<!href="|">)(https?:\/\/[^\s<]+)/g,
    '<a class="memo-link" href="$1" target="_blank" rel="noopener">$1</a>',
  );

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatDetailedTime(isoString: string): string {
  const d = new Date(isoString);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${year} · ${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconPin() {
  return (
    <svg className="size-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625V10.125C3 9.504 3.504 9 4.125 9h3.375m7.5 0h3.375c.621 0 1.125.504 1.125 1.125v10.5c0 .621-.504 1.125-1.125 1.125H11.625A1.125 1.125 0 0 1 10.5 20.625V10.125c0-.621.504-1.125 1.125-1.125z"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="size-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
