import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import type { GithubAuthStatus, TaskItem, TaskRecord, UserSettings, WorkspaceProject } from "@/lib/types";

const dataDir = path.join(process.cwd(), ".data");

async function readJsonFile<T>(filePath: string): Promise<T[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readJsonObject<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as T;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function normalizeCardOrder(order: string[] | undefined, defaults: readonly string[]) {
  const allowed = new Set(defaults);
  const normalized = (order ?? []).filter((item, index, items) => allowed.has(item) && items.indexOf(item) === index);

  for (const item of defaults) {
    if (!normalized.includes(item)) {
      normalized.push(item);
    }
  }

  return normalized;
}

const defaultDashboardMetricCardOrder = ["task-records", "empty-session", "task-bank", "workspace-projects"];
const defaultDashboardActionCardOrder = ["sync-feishu", "generate-tasks", "submit-feishu", "github-auth", "workspace-create"];

async function migrateTaskRecords() {
  const filePath = path.join(dataDir, "task-records.json");
  const records = await readJsonFile<TaskRecord>(filePath);

  for (const record of records) {
    await prisma.taskRecord.upsert({
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
        logs: record.logs,
        qcStatus: record.qcStatus,
        syncStatus: record.syncStatus,
      },
    });
  }

  return records.length;
}

async function migrateTaskBankItems() {
  const filePath = path.join(dataDir, "task-bank-items.json");
  const items = await readJsonFile<TaskItem>(filePath);

  for (const item of items) {
    await prisma.taskBankItem.upsert({
      where: { taskId: item.taskId },
      create: {
        taskId: item.taskId,
        uidBinding: item.uidBinding || "",
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
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      },
      update: {
        uidBinding: item.uidBinding || "",
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
    });
  }

  return items.length;
}

async function migrateWorkspaceProjects() {
  const filePath = path.join(dataDir, "workspace-projects.json");
  const projects = await readJsonFile<WorkspaceProject>(filePath);

  for (const project of projects) {
    await prisma.workspaceProject.upsert({
      where: { workspaceId: project.workspaceId },
      create: {
        workspaceId: project.workspaceId,
        taskId: project.taskId,
        repoName: project.repoName,
        githubOwner: project.githubOwner,
        githubUrl: project.githubUrl,
        localPath: project.localPath,
        visibility: project.visibility,
        cloneEnabled: project.cloneEnabled,
        traeOpened: project.traeOpened,
        traeAppName: project.traeAppName,
        status: project.status,
        createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
        errorMessage: project.errorMessage ?? null,
      },
      update: {
        taskId: project.taskId,
        repoName: project.repoName,
        githubOwner: project.githubOwner,
        githubUrl: project.githubUrl,
        localPath: project.localPath,
        visibility: project.visibility,
        cloneEnabled: project.cloneEnabled,
        traeOpened: project.traeOpened,
        traeAppName: project.traeAppName,
        status: project.status,
        errorMessage: project.errorMessage ?? null,
      },
    });
  }

  return projects.length;
}

async function migrateUserSettings() {
  const filePath = path.join(dataDir, "user-settings.json");
  const settings = await readJsonObject<UserSettings>(filePath);
  if (!settings) {
    return 0;
  }

  await prisma.userSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      feishuAppId: settings.feishuAppId,
      feishuAppSecret: settings.feishuAppSecret,
      feishuRedirectUri: settings.feishuRedirectUri,
      feishuBaseUrl: settings.feishuBaseUrl,
      sessionSecret: settings.sessionSecret,
      githubOwner: settings.githubOwner,
      repoVisibility: settings.repoVisibility,
      cloneEnabled: settings.cloneEnabled,
      openTraeEnabled: settings.openTraeEnabled,
      localRoot: settings.localRoot,
      traeAppName: settings.traeAppName,
      modelProvider: settings.modelProvider,
      modelBaseUrl: settings.modelBaseUrl,
      modelApiPath: settings.modelApiPath,
      model: settings.model,
      modelKey: settings.modelKey,
      dashboardMetricCardOrder: JSON.stringify(normalizeCardOrder(settings.dashboardMetricCardOrder, defaultDashboardMetricCardOrder)),
      dashboardActionCardOrder: JSON.stringify(normalizeCardOrder(settings.dashboardActionCardOrder, defaultDashboardActionCardOrder)),
    },
    update: {
      feishuAppId: settings.feishuAppId,
      feishuAppSecret: settings.feishuAppSecret,
      feishuRedirectUri: settings.feishuRedirectUri,
      feishuBaseUrl: settings.feishuBaseUrl,
      sessionSecret: settings.sessionSecret,
      githubOwner: settings.githubOwner,
      repoVisibility: settings.repoVisibility,
      cloneEnabled: settings.cloneEnabled,
      openTraeEnabled: settings.openTraeEnabled,
      localRoot: settings.localRoot,
      traeAppName: settings.traeAppName,
      modelProvider: settings.modelProvider,
      modelBaseUrl: settings.modelBaseUrl,
      modelApiPath: settings.modelApiPath,
      model: settings.model,
      modelKey: settings.modelKey,
      dashboardMetricCardOrder: JSON.stringify(normalizeCardOrder(settings.dashboardMetricCardOrder, defaultDashboardMetricCardOrder)),
      dashboardActionCardOrder: JSON.stringify(normalizeCardOrder(settings.dashboardActionCardOrder, defaultDashboardActionCardOrder)),
    },
  });

  return 1;
}

async function migrateGithubAuthStatus() {
  const filePath = path.join(dataDir, "github-auth-status.json");
  const status = await readJsonObject<GithubAuthStatus>(filePath);
  if (!status) {
    return 0;
  }

  await prisma.githubAuthStatus.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      authorized: status.authorized,
      message: status.message ?? null,
      accountName: status.accountName ?? null,
      checkedAt: status.checkedAt ? new Date(status.checkedAt) : new Date(),
    },
    update: {
      authorized: status.authorized,
      message: status.message ?? null,
      accountName: status.accountName ?? null,
      checkedAt: status.checkedAt ? new Date(status.checkedAt) : new Date(),
    },
  });

  return 1;
}

async function main() {
  const [taskRecordCount, taskBankCount, workspaceCount, userSettingsCount, githubAuthStatusCount] = await Promise.all([
    migrateTaskRecords(),
    migrateTaskBankItems(),
    migrateWorkspaceProjects(),
    migrateUserSettings(),
    migrateGithubAuthStatus(),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        migrated: {
          taskRecords: taskRecordCount,
          taskBankItems: taskBankCount,
          workspaceProjects: workspaceCount,
          userSettings: userSettingsCount,
          githubAuthStatus: githubAuthStatusCount,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
