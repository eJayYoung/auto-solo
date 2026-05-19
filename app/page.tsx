import { DashboardCards } from "@/components/dashboard-cards";
import { StatusBadge } from "@/components/status-badge";
import { buildTaskBank } from "@/lib/services/feishu-base";
import { readStoredTaskRecords } from "@/lib/services/local-task-record-store";
import { readUserSettings } from "@/lib/services/local-user-settings-store";

const actionCards = [
  {
    id: "sync-feishu",
    kind: "static" as const,
    title: "同步飞书表格",
    description: "从飞书 Base 拉取任务记录，刷新任务表和待绑定 UID 池。",
    actionLabel: "一键同步",
  },
  {
    id: "generate-tasks",
    kind: "static" as const,
    title: "生成题目",
    description: "使用默认模型生成题目，并绑定 Trae Session ID 为空的记录。",
    actionLabel: "一键生成",
  },
  {
    id: "github-auth",
    kind: "github-auth" as const,
  },
  {
    id: "workspace-create",
    kind: "workspace-create" as const,
  },
];

export default async function HomePage() {
  const [taskRecords, settings] = await Promise.all([readStoredTaskRecords(), readUserSettings()]);
  const taskItems = buildTaskBank(taskRecords);
  const emptySessionCount = taskRecords.filter((record) => !record.traeSessionId).length;
  const metricCards = [
    { id: "task-records", label: "任务记录", value: taskRecords.length },
    { id: "empty-session", label: "待绑定 UID", value: emptySessionCount },
    { id: "task-bank", label: "题库题目", value: taskItems.length },
    { id: "workspace-projects", label: "工作区项目", value: 0 },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-slate-950 p-8 text-white shadow-sm">
        <div className="max-w-3xl">
          <StatusBadge tone="success">工作台已就绪</StatusBadge>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Solo Coder 标注工作台</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            首页集中承接飞书同步、题目生成、仓库创建和飞书回填。同步后的飞书任务记录会保存在本地，用于刷新任务表和题库统计。
          </p>
        </div>
        <a className="mt-6 inline-block text-sm text-slate-300 underline" href={settings.feishuBaseUrl} target="_blank" rel="noreferrer">
          打开飞书 Base
        </a>
      </section>

      <DashboardCards
        metricCards={metricCards}
        actionCards={actionCards}
        initialSettings={settings}
        initialMetricOrder={settings.dashboardMetricCardOrder}
        initialActionOrder={settings.dashboardActionCardOrder}
      />
    </div>
  );
}
