export type Locale = "auto" | "en" | "zh_CN" | "ja" | "ko";

export interface ExtensionConfig {
  hostUrl: string;
  token: string;
  defaultTags: string;
  defaultVisibility: "PRIVATE" | "PROTECTED" | "PUBLIC";
  locale: Locale;
}

export interface ClipData {
  title: string;
  content: string;
  byteLength: number;
}

export interface PageInfo {
  title: string;
  url: string;
}

export interface PendingClip {
  type: "selection";
  text: string;
  url: string;
  title: string;
}

export interface UploadedAttachment {
  name: string;
  filename: string;
  type: string;
  size: number;
}

export interface MemoItem {
  name: string;
  content: string;
  snippet: string;
  pinned: boolean;
  displayTime: string;
  createTime: string;
  tags: string[];
  property?: { title?: string };
}

export interface ListMemosResponse {
  memos: MemoItem[];
  nextPageToken: string;
}

export interface FormatInput {
  thought: string;
  tags: string;
  includeContent: boolean;
  clipData: ClipData | null;
  selectionText: string;
  pageTitle: string;
  pageUrl: string;
}
