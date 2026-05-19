import { SourceType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { TaskItem } from "@/lib/types";

function normalizeTaskItem(item: TaskItem): TaskItem {
  return {
    ...item,
    uidBinding: item.uidBinding || "",
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

function dedupeTaskItems(items: TaskItem[]): TaskItem[] {
  const seen = new Set<string>();
  const result: TaskItem[] = [];

  for (const item of items) {
    const key = item.promptContent.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalizeTaskItem(item));
  }

  return result;
}

function toTaskItem(item: {
  taskId: string;
  uidBinding: string;
  title: string;
  promptContent: string;
  promptMode: string;
  model: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  sourceType: SourceType;
  status: TaskStatus;
  submittedAt: Date | null;
  createdAt: Date;
}): TaskItem {
  return {
    taskId: item.taskId,
    uidBinding: item.uidBinding,
    title: item.title,
    promptContent: item.promptContent,
    promptMode: item.promptMode as "append" | "override",
    model: item.model,
    taskType: item.taskType,
    businessDomain: item.businessDomain,
    modifyScope: item.modifyScope,
    sourceType: item.sourceType,
    status: item.status,
    submittedAt: item.submittedAt?.toISOString(),
    createdAt: item.createdAt.toISOString(),
  };
}

export async function readStoredTaskBankItems(): Promise<TaskItem[]> {
  const items = await prisma.taskBankItem.findMany({
    orderBy: { createdAt: "desc" },
  });
  return items.map(toTaskItem);
}

export async function writeStoredTaskBankItems(items: TaskItem[]): Promise<TaskItem[]> {
  const deduped = dedupeTaskItems(items);

  await prisma.$transaction(
    deduped.map((item) =>
      prisma.taskBankItem.upsert({
        where: { taskId: item.taskId },
        create: {
          taskId: item.taskId,
          uidBinding: item.uidBinding,
          title: item.title,
          promptContent: item.promptContent,
          promptMode: item.promptMode,
          model: item.model,
          taskType: item.taskType,
          businessDomain: item.businessDomain,
          modifyScope: item.modifyScope,
          sourceType: item.sourceType,
          status: item.status,
          submittedAt: item.submittedAt ? new Date(item.submittedAt) : null,
          createdAt: new Date(item.createdAt),
        },
        update: {
          uidBinding: item.uidBinding,
          title: item.title,
          promptContent: item.promptContent,
          promptMode: item.promptMode,
          model: item.model,
          taskType: item.taskType,
          businessDomain: item.businessDomain,
          modifyScope: item.modifyScope,
          sourceType: item.sourceType,
          status: item.status,
          submittedAt: item.submittedAt ? new Date(item.submittedAt) : null,
        },
      }),
    ),
  );

  return readStoredTaskBankItems();
}

export async function appendStoredTaskBankItems(items: TaskItem[]): Promise<TaskItem[]> {
  return writeStoredTaskBankItems(items);
}

export async function removeStoredTaskBankItem(taskId: string): Promise<TaskItem[]> {
  await prisma.taskBankItem.deleteMany({ where: { taskId } });
  return readStoredTaskBankItems();
}
