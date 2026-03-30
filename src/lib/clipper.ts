import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { ClipData } from "./types";

export interface ClipResult {
  data: ClipData;
  pageTitle: string;
  pageUrl: string;
}

/**
 * Extract article content from the active tab and convert to Markdown.
 *
 * Pipeline:
 *   1. Grab page HTML via chrome.scripting
 *   2. Readability — isolate article body
 *   3. Turndown + GFM plugin — HTML → Markdown (tables, strikethrough, task lists)
 *   4. Custom rules — code block language detection, <mark> highlight
 *   5. Post-processing — normalize whitespace, clean artifacts
 */
export async function clipActiveTab(): Promise<ClipResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new ClipError("errNoTab");

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });
  const html = results[0]?.result as string | undefined;
  if (!html) throw new ClipError("errNoContent");

  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = doc.createElement("base");
  base.href = tab.url || "";
  doc.head.prepend(base);

  const article = new Readability(doc).parse();
  if (!article) throw new ClipError("errNoArticle");

  const markdown = htmlToMarkdown(article.content);

  return {
    data: {
      title: article.title || tab.title || "",
      content: markdown,
      byteLength: new Blob([markdown]).size,
    },
    pageTitle: tab.title || "",
    pageUrl: tab.url || "",
  };
}

export class ClipError extends Error {
  constructor(public readonly messageKey: string) {
    super(messageKey);
  }
}

// ---------------------------------------------------------------------------
// Turndown setup
// ---------------------------------------------------------------------------

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });

  td.use(gfm);

  // Fenced code blocks: detect language from class="language-xxx"
  td.addRule("fencedCodeBlock", {
    filter(node, options) {
      return (
        options.codeBlockStyle === "fenced" &&
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content, node) {
      const code = node.firstChild as HTMLElement;
      const lang = extractCodeLang(code);
      const text = code.textContent || "";
      const fence = longestFenceSequence(text) + "`";
      return `\n\n${fence}${lang}\n${text.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });

  // <mark> → ==highlight==
  td.addRule("highlight", {
    filter: "mark",
    replacement(content) {
      return `==${content}==`;
    },
  });

  // <figure> with <img> — preserve caption
  td.addRule("figure", {
    filter: "figure",
    replacement(_content, node) {
      const img = (node as HTMLElement).querySelector("img");
      const caption = (node as HTMLElement).querySelector("figcaption");
      if (!img) return _content;
      const alt = caption?.textContent?.trim() || img.alt || "";
      const src = img.getAttribute("src") || "";
      return `\n\n![${alt}](${src})\n\n`;
    },
  });

  td.remove(["script", "style", "noscript"]);

  return td;
}

function extractCodeLang(code: HTMLElement): string {
  const cls = code.getAttribute("class") || "";
  const match = cls.match(/(?:language|lang|highlight)-(\w[\w+#-]*)/i);
  return match ? match[1] : "";
}

function longestFenceSequence(text: string): string {
  const matches = text.match(/`{3,}/g);
  if (!matches) return "```";
  const max = Math.max(...matches.map((m) => m.length));
  return "`".repeat(max + 1);
}

// Singleton — rules are stateless, safe to reuse
let _td: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (!_td) _td = createTurndownService();
  return _td;
}

// ---------------------------------------------------------------------------
// Public conversion function (also useful independently)
// ---------------------------------------------------------------------------

export function htmlToMarkdown(html: string): string {
  const raw = getTurndown().turndown(html);
  return postProcess(raw);
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

function postProcess(md: string): string {
  let result = md;

  // Collapse 3+ consecutive blank lines → 2
  result = result.replace(/\n{3,}/g, "\n\n");

  // Trim trailing whitespace on each line (preserve intentional <br> via 2 trailing spaces)
  result = result.replace(/[ \t]+$/gm, "");

  // Remove leading/trailing whitespace from the whole document
  result = result.trim();

  // Ensure single trailing newline
  result += "\n";

  return result;
}
