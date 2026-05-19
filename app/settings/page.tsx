import { SettingsForm } from "@/components/settings-form";
import { readUserSettings } from "@/lib/services/local-user-settings-store";

export default async function SettingsPage() {
  const settings = await readUserSettings();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-950">设置</h1>
        <p className="mt-2 text-sm text-slate-600">维护系统配置，保存后会写入本地 SQLite 数据库，并被工作台、登录与同步流程统一读取。</p>
      </section>

      <SettingsForm initialSettings={settings} />
    </div>
  );
}
