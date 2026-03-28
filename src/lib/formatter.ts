import type { FormatInput } from "./types";

export interface FormatResult {
  content: string;
  truncated: boolean;
}

export function formatMemoContent(input: FormatInput, maxBytes?: number): FormatResult {
  const parts: string[] = [];

  const tags = input.tags.trim();
  if (tags) {
    parts.push(tags);
  }

  if (input.thought.trim()) {
    parts.push(input.thought.trim());
  }

  if (input.selectionText.trim()) {
    parts.push(quoteBlock(input.selectionText.trim()));
    if (input.pageUrl) {
      const title = input.pageTitle || input.pageUrl;
      parts.push(`[${title}](${input.pageUrl})`);
    }
  } else if (input.includeContent && (input.clipData || input.pageUrl)) {
    const title = input.clipData?.title || input.pageTitle || input.pageUrl;
    parts.push(`[${title}](${input.pageUrl})`);

    if (input.clipData?.content) {
      parts.push("---");
      parts.push(input.clipData.content);
    }
  }

  const full = parts.join("\n\n");

  if (!maxBytes || byteLength(full) <= maxBytes) {
    return { content: full, truncated: false };
  }

  return truncateToFit(parts, maxBytes);
}

function truncateToFit(parts: string[], maxBytes: number): FormatResult {
  const suffix = "\n\n...\n\n*（正文已截断，原文过长）*";
  const suffixBytes = byteLength(suffix);
  const budget = maxBytes - suffixBytes;

  if (budget <= 0) {
    return { content: parts[0]?.slice(0, maxBytes) || "", truncated: true };
  }

  let result = "";
  for (const part of parts) {
    const candidate = result ? result + "\n\n" + part : part;
    if (byteLength(candidate) > budget) {
      const remaining = budget - byteLength(result ? result + "\n\n" : "");
      if (remaining > 100) {
        const truncatedPart = truncateStringToBytes(part, remaining);
        result = result ? result + "\n\n" + truncatedPart : truncatedPart;
      }
      break;
    }
    result = candidate;
  }

  return { content: result + suffix, truncated: true };
}

function quoteBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function byteLength(str: string): number {
  return new Blob([str]).size;
}

function truncateStringToBytes(str: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  if (encoded.length <= maxBytes) return str;
  const truncated = encoded.slice(0, maxBytes);
  return new TextDecoder().decode(truncated).replace(/\uFFFD$/, "");
}
