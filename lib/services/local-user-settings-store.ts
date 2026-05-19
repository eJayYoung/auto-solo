import { RepoVisibility, WorkspaceProjectStatus } from "@prisma/client";
import { DEFAULT_FEISHU_BASE_URL, DEFAULT_LOCAL_ROOT, DEFAULT_MODEL, DEFAULT_TRAE_APP_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { UserSettings, UserSettingsInput, WorkspaceProject } from "@/lib/types";

const defaultDashboardMetricCardOrder = ["task-records", "empty-session", "task-bank", "workspace-projects"];
const defaultDashboardActionCardOrder = ["sync-feishu", "generate-tasks", "submit-feishu", "github-auth", "workspace-create"];

const defaultSettingsId = "default";

const defaultUserSettings: UserSettings = {
  feishuAppId: "",
  feishuAppSecret: "",
  feishuRedirectUri: "http://localhost:3000/api/auth/feishu/callback",
  feishuBaseUrl: DEFAULT_FEISHU_BASE_URL,
  sessionSecret: "replace-with-a-long-random-secret",
  githubOwner: "example",
  repoVisibility: "public",
  cloneEnabled: true,
  openTraeEnabled: true,
  localRoot: DEFAULT_LOCAL_ROOT,
  traeAppName: DEFAULT_TRAE_APP_NAME,
  modelProvider: "openai_compatible",
  modelBaseUrl: "https://api.openai.com/v1",
  modelApiPath: "/chat/completions",
  model: DEFAULT_MODEL,
  modelKey: "",
  dashboardMetricCardOrder: defaultDashboardMetricCardOrder,
  dashboardActionCardOrder: defaultDashboardActionCardOrder,
};

function normalizeCardOrder(order: string[], defaults: readonly string[]) {
  const allowed = new Set(defaults);
  const normalized = order.filter((item, index) => allowed.has(item) && order.indexOf(item) === index);

  for (const item of defaults) {
    if (!normalized.includes(item)) {
      normalized.push(item);
    }
  }

  return normalized;
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function toUserSettings(settings: {
  feishuAppId: string;
  feishuAppSecret: string;
  feishuRedirectUri: string;
  feishuBaseUrl: string;
  sessionSecret: string;
  githubOwner: string;
  repoVisibility: RepoVisibility;
  cloneEnabled: boolean;
  openTraeEnabled: boolean;
  localRoot: string;
  traeAppName: string;
  modelProvider: string;
  modelBaseUrl: string;
  modelApiPath: string;
  model: string;
  modelKey: string;
  dashboardMetricCardOrder: string;
  dashboardActionCardOrder: string;
}): UserSettings {
  return {
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
    modelProvider: "openai_compatible",
    modelBaseUrl: settings.modelBaseUrl,
    modelApiPath: settings.modelApiPath,
    model: settings.model,
    modelKey: settings.modelKey,
    dashboardMetricCardOrder: normalizeCardOrder(parseStringArray(settings.dashboardMetricCardOrder), defaultDashboardMetricCardOrder),
    dashboardActionCardOrder: normalizeCardOrder(parseStringArray(settings.dashboardActionCardOrder), defaultDashboardActionCardOrder),
  };
}

function toUserSettingsCreateInput(settings: UserSettings) {
  return {
    id: defaultSettingsId,
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
  };
}

export async function readUserSettings(): Promise<UserSettings> {
  const settings = await prisma.userSettings.findUnique({ where: { id: defaultSettingsId } });
  if (settings) {
    return toUserSettings(settings);
  }

  const created = await prisma.userSettings.create({ data: toUserSettingsCreateInput(defaultUserSettings) });
  return toUserSettings(created);
}

export async function writeUserSettings(input: UserSettingsInput): Promise<UserSettings> {
  const nextSettings: UserSettings = { ...defaultUserSettings, ...input };
  const settings = await prisma.userSettings.upsert({
    where: { id: defaultSettingsId },
    create: toUserSettingsCreateInput(nextSettings),
    update: toUserSettingsCreateInput(nextSettings),
  });
  return toUserSettings(settings);
}

function toWorkspaceProject(project: {
  workspaceId: string;
  taskId: string;
  recordId: string;
  uid: string;
  repoName: string;
  githubOwner: string;
  githubUrl: string;
  localPath: string;
  currentBranch: string;
  metadataPath: string;
  visibility: RepoVisibility;
  cloneEnabled: boolean;
  traeOpened: boolean;
  traeAppName: string;
  status: WorkspaceProjectStatus;
  createdAt: Date;
  lastCollectedAt: Date | null;
  errorMessage: string | null;
}): WorkspaceProject {
  return {
    workspaceId: project.workspaceId,
    taskId: project.taskId,
    recordId: project.recordId,
    uid: project.uid,
    repoName: project.repoName,
    githubOwner: project.githubOwner,
    githubUrl: project.githubUrl,
    localPath: project.localPath,
    currentBranch: project.currentBranch,
    metadataPath: project.metadataPath,
    visibility: project.visibility,
    cloneEnabled: project.cloneEnabled,
    traeOpened: project.traeOpened,
    traeAppName: project.traeAppName,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    lastCollectedAt: project.lastCollectedAt?.toISOString(),
    errorMessage: project.errorMessage ?? undefined,
  };
}

export async function readWorkspaceProjects(): Promise<WorkspaceProject[]> {
  const projects = await prisma.workspaceProject.findMany({
    orderBy: { createdAt: "desc" },
  });
  return projects.map(toWorkspaceProject);
}

export async function appendWorkspaceProject(project: WorkspaceProject): Promise<WorkspaceProject[]> {
  await prisma.workspaceProject.upsert({
    where: { workspaceId: project.workspaceId },
    create: {
      workspaceId: project.workspaceId,
      taskId: project.taskId,
      recordId: project.recordId,
      uid: project.uid,
      repoName: project.repoName,
      githubOwner: project.githubOwner,
      githubUrl: project.githubUrl,
      localPath: project.localPath,
      currentBranch: project.currentBranch,
      metadataPath: project.metadataPath,
      visibility: project.visibility,
      cloneEnabled: project.cloneEnabled,
      traeOpened: project.traeOpened,
      traeAppName: project.traeAppName,
      status: project.status,
      createdAt: new Date(project.createdAt),
      lastCollectedAt: project.lastCollectedAt ? new Date(project.lastCollectedAt) : null,
      errorMessage: project.errorMessage ?? null,
    },
    update: {
      taskId: project.taskId,
      recordId: project.recordId,
      uid: project.uid,
      repoName: project.repoName,
      githubOwner: project.githubOwner,
      githubUrl: project.githubUrl,
      localPath: project.localPath,
      currentBranch: project.currentBranch,
      metadataPath: project.metadataPath,
      visibility: project.visibility,
      cloneEnabled: project.cloneEnabled,
      traeOpened: project.traeOpened,
      traeAppName: project.traeAppName,
      status: project.status,
      lastCollectedAt: project.lastCollectedAt ? new Date(project.lastCollectedAt) : null,
      errorMessage: project.errorMessage ?? null,
    },
  });

  return readWorkspaceProjects();
}
