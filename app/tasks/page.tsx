import { AutomationScriptQa } from "@/components/automation-script-qa";
import { TableShell } from "@/components/table-shell";
import { TaskRecordsPanel } from "@/components/task-records-panel";
import { readStoredTaskRecords } from "@/lib/services/local-task-record-store";
import { readLatestWorkspaceRunsByRecord } from "@/lib/services/workspace-runtime";

export default async function TasksPage() {
  const [taskRecords, workspaceRunsByRecord] = await Promise.all([readStoredTaskRecords(), readLatestWorkspaceRunsByRecord()]);

  return (
    <div className="space-y-6">
      <PageHeader title="任务表" />
      <AutomationScriptQa />
      <TableShell title="飞书任务记录">
        <TaskRecordsPanel initialRecords={taskRecords} initialWorkspaceRunsByRecord={workspaceRunsByRecord} />
      </TableShell>
    </div>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
    </section>
  );
}
