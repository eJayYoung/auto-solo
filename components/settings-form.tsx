"use client";

import { useState } from "react";
import { MODEL_OPTIONS } from "@/lib/constants";
import type { UserSettings } from "@/lib/types";

type SettingsFormProps = {
  initialSettings: UserSettings;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; error: string };

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  function updateField<Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveSettings() {
    setSaveState({ status: "saving" });
    const normalizedSettings: UserSettings = {
      ...settings,
      feishuRedirectUri: settings.feishuRedirectUri.trim(),
      feishuBaseUrl: settings.feishuBaseUrl.trim(),
      modelBaseUrl: settings.modelBaseUrl.trim(),
      modelApiPath: settings.modelApiPath.trim(),
      modelKey: settings.modelKey.trim(),
    };
    const response = await fetch("/api/user-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedSettings),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: UserSettings };

    if (!response.ok || !payload.ok || !payload.data) {
      setSaveState({ status: "error", error: payload.error || "保存失败" });
      return;
    }

    setSettings(payload.data);
    setSaveState({ status: "success" });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">默认配置</h2>
      </div>
      <div className="divide-y divide-slate-100">
        <SettingRow label="飞书凭证获取指引">
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              1. 登录飞书开放平台（
              <a className="text-slate-900 underline" href="https://open.feishu.cn" rel="noreferrer" target="_blank">
                https://open.feishu.cn
              </a>
              ），进入你创建的应用。
            </p>
            <p>2. 在应用的“凭证与基础信息”页复制 App ID，填到下面的 App ID 配置。</p>
            <p>3. 在同一页复制 App Secret，填到下面的 App Secret 配置。</p>
            <p>4. 在“安全设置 / 重定向 URL”里配置下方回调地址。</p>
          </div>
        </SettingRow>
        <SettingRow label="飞书 App ID">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.feishuAppId} onChange={(event) => updateField("feishuAppId", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="飞书 App Secret">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.feishuAppSecret} onChange={(event) => updateField("feishuAppSecret", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="飞书回调地址">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.feishuRedirectUri} onChange={(event) => updateField("feishuRedirectUri", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="飞书表格地址">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.feishuBaseUrl} onChange={(event) => updateField("feishuBaseUrl", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="会话签名密钥">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.sessionSecret} onChange={(event) => updateField("sessionSecret", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="默认 GitHub owner">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.githubOwner} onChange={(event) => updateField("githubOwner", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="仓库可见性">
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.repoVisibility} onChange={(event) => updateField("repoVisibility", event.currentTarget.value as UserSettings["repoVisibility"])}>
            <option value="private">private</option>
            <option value="public">public</option>
          </select>
        </SettingRow>
        <SettingRow label="默认 clone 到本地">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={settings.cloneEnabled} onChange={(event) => updateField("cloneEnabled", event.currentTarget.checked)} />
            <span>{settings.cloneEnabled ? "true" : "false"}</span>
          </label>
        </SettingRow>
        <SettingRow label="默认打开 Trae">
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={settings.openTraeEnabled} onChange={(event) => updateField("openTraeEnabled", event.currentTarget.checked)} />
            <span>{settings.openTraeEnabled ? "true" : "false"}</span>
          </label>
        </SettingRow>
        <SettingRow label="默认本地目录">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.localRoot} onChange={(event) => updateField("localRoot", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="Trae 应用名称">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.traeAppName} onChange={(event) => updateField("traeAppName", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="模型提供方">
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.modelProvider} onChange={(event) => updateField("modelProvider", event.currentTarget.value as UserSettings["modelProvider"])}>
            <option value="openai_compatible">openai_compatible</option>
          </select>
        </SettingRow>
        <SettingRow label="Model Base URL">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.modelBaseUrl} onChange={(event) => updateField("modelBaseUrl", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="Model API Path">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.modelApiPath} onChange={(event) => updateField("modelApiPath", event.currentTarget.value)} />
        </SettingRow>
        <SettingRow label="默认生成模型">
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.model} onChange={(event) => updateField("model", event.currentTarget.value)}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Model Key">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={settings.modelKey} onChange={(event) => updateField("modelKey", event.currentTarget.value)} />
        </SettingRow>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
        <div className="text-sm text-slate-600">
          {saveState.status === "error" ? <span className="text-red-600">{saveState.error}</span> : null}
          {saveState.status === "success" ? <span className="text-emerald-600">已保存</span> : null}
        </div>
        <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={saveState.status === "saving"} onClick={saveSettings} type="button">
          {saveState.status === "saving" ? "保存中" : "保存设置"}
        </button>
      </div>
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-5 py-4 md:grid-cols-3">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}
