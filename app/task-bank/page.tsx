import { TaskBankPageClient } from "@/components/task-bank-page-client";
import { buildTaskBank } from "@/lib/services/feishu-base";
import { readStoredTaskBankItems, writeStoredTaskBankItems } from "@/lib/services/local-task-bank-store";
import { readStoredTaskRecords } from "@/lib/services/local-task-record-store";
import { readUserSettings } from "@/lib/services/local-user-settings-store";

export default async function TaskBankPage() {
  const [taskRecords, storedItems, settings] = await Promise.all([
    readStoredTaskRecords(),
    readStoredTaskBankItems(),
    readUserSettings(),
  ]);

  const historyItems = buildTaskBank(taskRecords);
  const initialSeedItems = [...storedItems, ...historyItems];
  const taskItems = await writeStoredTaskBankItems(initialSeedItems);

  return <TaskBankPageClient initialItems={taskItems} model={settings.model} />;
}
