import { SyncStatus } from "@prisma/client";
import { prisma } from "../db";
import type { TaskRecord, TaskRecordSubmitInput, WorkspaceRunSubmitInput } from "@/lib/types";

function parseScreenshotAttachments(value: string): TaskRecord["screenshotAttachments"] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as TaskRecord["screenshotAttachments"]) : [];
  } catch {
    return [];
  }
}

function toTaskRecord(record: {
  uid: string;
  recordId: string;
  traeSessionId: string;
  round: number;
  userPrompt: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  taskCompleted: string;
  processSatisfaction: string;
  unsatisfiedReason: string;
  githubUrl: string;
  branchOrFolder: string;
  screenshots: string;
  screenshotAttachments: string;
  screenshotFileToken: string;
  screenshotExtra: string;
  logs: string;
  qcStatus: string;
  syncStatus: SyncStatus;
  updatedAt: Date;
}): TaskRecord {
  return {
    uid: record.uid,
    recordId: record.recordId,
    traeSessionId: record.traeSessionId,
    round: record.round,
    userPrompt: record.userPrompt,
    taskType: record.taskType,
    businessDomain: record.businessDomain,
    modifyScope: record.modifyScope,
    taskCompleted: record.taskCompleted,
    processSatisfaction: record.processSatisfaction,
    unsatisfiedReason: record.unsatisfiedReason,
    githubUrl: record.githubUrl,
    branchOrFolder: record.branchOrFolder,
    screenshots: record.screenshots,
    screenshotAttachments: parseScreenshotAttachments(record.screenshotAttachments),
    screenshotFileToken: record.screenshotFileToken,
    screenshotExtra: record.screenshotExtra,
    logs: record.logs,
    qcStatus: record.qcStatus,
    syncStatus: record.syncStatus,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function readStoredTaskRecords(): Promise<TaskRecord[]> {
  const records = await prisma.taskRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return records.map(toTaskRecord);
}

export async function writeStoredTaskRecords(records: TaskRecord[]): Promise<TaskRecord[]> {
  await prisma.$transaction(
    records.map((record) =>
      prisma.taskRecord.upsert({
        where: { recordId: record.recordId },
        create: {
          uid: record.uid,
          recordId: record.recordId,
          traeSessionId: record.traeSessionId,
          round: record.round,
          userPrompt: record.userPrompt,
          taskType: record.taskType,
          businessDomain: record.businessDomain,
          modifyScope: record.modifyScope,
          taskCompleted: record.taskCompleted,
          processSatisfaction: record.processSatisfaction,
          unsatisfiedReason: record.unsatisfiedReason,
          githubUrl: record.githubUrl,
          branchOrFolder: record.branchOrFolder,
          screenshots: record.screenshots,
          screenshotAttachments: JSON.stringify(record.screenshotAttachments),
          screenshotFileToken: record.screenshotFileToken,
          screenshotExtra: record.screenshotExtra,
          logs: record.logs,
          qcStatus: record.qcStatus,
          syncStatus: record.syncStatus,
        },
        update: {
          uid: record.uid,
          traeSessionId: record.traeSessionId,
          round: record.round,
          userPrompt: record.userPrompt,
          taskType: record.taskType,
          businessDomain: record.businessDomain,
          modifyScope: record.modifyScope,
          taskCompleted: record.taskCompleted,
          processSatisfaction: record.processSatisfaction,
          unsatisfiedReason: record.unsatisfiedReason,
          githubUrl: record.githubUrl,
          branchOrFolder: record.branchOrFolder,
          screenshots: record.screenshots,
          screenshotAttachments: JSON.stringify(record.screenshotAttachments),
          screenshotFileToken: record.screenshotFileToken,
          screenshotExtra: record.screenshotExtra,
          logs: record.logs,
          qcStatus: record.qcStatus,
          syncStatus: record.syncStatus,
        },
      }),
    ),
  );

  return readStoredTaskRecords();
}

export async function updateStoredTaskRecord(input: TaskRecordSubmitInput): Promise<TaskRecord[]> {
  await prisma.taskRecord.update({
    where: { recordId: input.recordId },
    data: {
      traeSessionId: input.traeSessionId,
      round: input.round,
      userPrompt: input.userPrompt,
      taskType: input.taskType,
      businessDomain: input.businessDomain,
      modifyScope: input.modifyScope,
      githubUrl: input.githubUrl,
      branchOrFolder: input.branchOrFolder,
      logs: input.logs,
      taskCompleted: input.taskCompleted,
      processSatisfaction: input.processSatisfaction,
      unsatisfiedReason: input.unsatisfiedReason,
    },
  });

  return readStoredTaskRecords();
}

export async function resolveTaskRecordForWorkspaceRuntime(input: WorkspaceRunSubmitInput): Promise<TaskRecord> {
  if (input.recordId) {
    const record = await prisma.taskRecord.findUnique({ where: { recordId: input.recordId } });
    if (!record) {
      throw new Error(`Task record not found: ${input.recordId}`);
    }
    if (input.uid && record.uid !== input.uid) {
      throw new Error(`Task record UID mismatch: expected ${record.uid}, received ${input.uid}`);
    }
    return toTaskRecord(record);
  }

  if (!input.uid) {
    throw new Error("Workspace runtime is missing uid");
  }

  const records = await prisma.taskRecord.findMany({
    where: { uid: input.uid },
    orderBy: { updatedAt: "desc" },
  });
  if (records.length === 0) {
    throw new Error(`Task record not found for UID: ${input.uid}`);
  }
  if (records.length > 1) {
    throw new Error(`Multiple task records found for UID ${input.uid}; rerun with --record-id <recordId>`);
  }

  return toTaskRecord(records[0]);
}

export async function uploadWorkspaceRuntimeToTaskRecord(input: WorkspaceRunSubmitInput): Promise<TaskRecord> {
  const targetRecord = await resolveTaskRecordForWorkspaceRuntime(input);

  const updated = await prisma.taskRecord.update({
    where: { recordId: targetRecord.recordId },
    data: {
      githubUrl: input.githubUrl,
      branchOrFolder: input.branchName || input.localPath,
      screenshots: input.screenshotPath,
      screenshotExtra: input.screenshotMimeType,
      logs: input.logsText,
      syncStatus: "draft",
    },
  });

  return toTaskRecord(updated);
}
