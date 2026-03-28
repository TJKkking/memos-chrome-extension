import { useEffect, useState } from "react";
import { loadConfig, saveConfig } from "@/lib/storage";
import { testConnection } from "@/lib/api";

type TestStatus = "idle" | "testing" | "success" | "error";

export function Options() {
  const [hostUrl, setHostUrl] = useState("");
  const [token, setToken] = useState("");
  const [defaultTags, setDefaultTags] = useState("#webclipper");
  const [defaultVisibility, setDefaultVisibility] = useState<"PRIVATE" | "PROTECTED" | "PUBLIC">(
    "PRIVATE",
  );
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");

  useEffect(() => {
    loadConfig().then((cfg) => {
      setHostUrl(cfg.hostUrl);
      setToken(cfg.token);
      setDefaultTags(cfg.defaultTags);
      setDefaultVisibility(cfg.defaultVisibility);
    });
  }, []);

  const handleSave = async () => {
    await saveConfig({
      hostUrl: hostUrl.replace(/\/+$/, ""),
      token,
      defaultTags,
      defaultVisibility,
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
      <h1 className="mb-8 text-lg font-semibold text-foreground">Memos Web Clipper 设置</h1>

      <div className="space-y-5">
        <Field label="Memos 地址" hint="例如 https://memos.example.com">
          <input
            type="url"
            value={hostUrl}
            onChange={(e) => setHostUrl(e.target.value)}
            placeholder="https://memos.example.com"
            className="field-input"
          />
        </Field>

        <Field label="Access Token" hint="在 Memos 设置 > Access Tokens 中创建">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="memos_pat_..."
            className="field-input"
          />
        </Field>

        <Field label="默认标签" hint="多个标签用空格分隔">
          <input
            type="text"
            value={defaultTags}
            onChange={(e) => setDefaultTags(e.target.value)}
            placeholder="#webclipper"
            className="field-input"
          />
        </Field>

        <Field label="默认可见性">
          <select
            value={defaultVisibility}
            onChange={(e) =>
              setDefaultVisibility(e.target.value as "PRIVATE" | "PROTECTED" | "PUBLIC")
            }
            className="field-input"
          >
            <option value="PRIVATE">仅自己可见</option>
            <option value="PROTECTED">登录用户可见</option>
            <option value="PUBLIC">公开</option>
          </select>
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
          >
            {saved ? "已保存" : "保存设置"}
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
              ? "测试中..."
              : testStatus === "success"
                ? "连接成功"
                : testStatus === "error"
                  ? "连接失败"
                  : "测试连接"}
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
