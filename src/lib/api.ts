import type { UploadedAttachment } from "./types";

const DEFAULT_CONTENT_LIMIT = 8192;

function baseUrl(hostUrl: string): string {
  return hostUrl.replace(/\/+$/, "");
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function createMemo(
  hostUrl: string,
  token: string,
  content: string,
  visibility: string,
  attachments?: UploadedAttachment[],
): Promise<void> {
  const body: Record<string, unknown> = { content, visibility };
  if (attachments?.length) {
    body.attachments = attachments.map((a) => ({ name: a.name }));
  }

  const response = await fetch(`${baseUrl(hostUrl)}/api/v1/memos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
  }
}

export async function uploadAttachment(
  hostUrl: string,
  token: string,
  file: File,
): Promise<UploadedAttachment> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  const response = await fetch(`${baseUrl(hostUrl)}/api/v1/attachments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({
      filename: file.name,
      type: file.type || "application/octet-stream",
      content: base64,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`上传失败: ${response.status}${text ? ` ${text}` : ""}`);
  }

  const data = await response.json();
  return {
    name: data.name,
    filename: data.filename || file.name,
    type: data.type || file.type,
    size: data.size || file.size,
  };
}

export async function getContentLengthLimit(hostUrl: string, token: string): Promise<number> {
  try {
    const response = await fetch(`${baseUrl(hostUrl)}/api/v1/instance/settings/MEMO_RELATED`, {
      headers: authHeaders(token),
    });
    if (!response.ok) return DEFAULT_CONTENT_LIMIT;
    const data = await response.json();
    const limit = data?.memoRelatedSetting?.contentLengthLimit;
    return typeof limit === "number" && limit > 0 ? limit : DEFAULT_CONTENT_LIMIT;
  } catch {
    return DEFAULT_CONTENT_LIMIT;
  }
}

export async function testConnection(hostUrl: string, token: string): Promise<boolean> {
  const response = await fetch(`${baseUrl(hostUrl)}/api/v1/memos?pageSize=1`, {
    headers: authHeaders(token),
  });
  return response.ok;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
