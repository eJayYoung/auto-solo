import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { submitTaskRecord } from "@/lib/services/feishu-base";
import { checkGithubAuthStatus } from "@/lib/services/github-auth";
import { updateStoredTaskRecord } from "@/lib/services/local-task-record-store";
import { appendWorkspaceProject } from "@/lib/services/local-user-settings-store";
import type {
  CreateWorkspaceBatchInput,
  CreateWorkspaceInput,
  CreateWorkspaceTargetRecord,
  WorkspaceProject,
  WorkspaceProjectBackfillResult,
  WorkspaceProjectBatchResult,
  WorkspaceProjectStatus,
} from "@/lib/types";

const execFileAsync = promisify(execFile);

export class GithubAuthRequiredError extends Error {
  constructor(message = "GitHub authorization is required") {
    super(message);
    this.name = "GithubAuthRequiredError";
  }
}

function expandHomeDir(value: string) {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function normalizeRepoName(value: string) {
  return value.trim();
}

function normalizeOwner(value: string) {
  return value.trim();
}

function buildWorkspaceProjectId() {
  return `WS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildWorkspaceMetadataPath(localPath: string) {
  return path.join(localPath, ".auto-solo.json");
}

async function writeWorkspaceMetadata(project: WorkspaceProject) {
  if (!project.cloneEnabled) {
    return;
  }

  await writeFile(
    project.metadataPath,
    `${JSON.stringify(
      {
        workspaceId: project.workspaceId,
        taskId: project.taskId,
        recordId: project.recordId,
        uid: project.uid,
        githubUrl: project.githubUrl,
        expectedRepoName: project.repoName,
      },
      null,
      2,
    )}\n`,
  );
}

function buildWorkspacePaths(input: CreateWorkspaceInput, repoName: string, githubOwner: string) {
  const localRoot = path.resolve(expandHomeDir(input.localRoot.trim()));
  const localPath = path.join(localRoot, repoName);
  const githubUrl = `https://github.com/${githubOwner}/${repoName}`;

  return { localRoot, localPath, githubUrl };
}

function buildBatchRepoNames(repoNames: string[]) {
  const normalizedRepoNames = repoNames.map(normalizeRepoName).filter(Boolean);
  if (normalizedRepoNames.length === 0) {
    throw new Error("repoNames must include at least one non-empty value");
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const repoName of normalizedRepoNames) {
    if (seen.has(repoName)) {
      duplicates.add(repoName);
    }
    seen.add(repoName);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate repo names are not allowed: ${Array.from(duplicates).join(", ")}`);
  }

  return normalizedRepoNames;
}

async function ensureCommandAvailable(command: string) {
  try {
    await execFileAsync("which", [command]);
  } catch {
    throw new Error(`${command} is not installed or not available in PATH`);
  }
}

async function ensurePathMissing(targetPath: string) {
  try {
    await access(targetPath, fsConstants.F_OK);
    throw new Error(`Local path already exists: ${targetPath}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function createGithubRepo(owner: string, repoName: string, visibility: "public" | "private") {
  const visibilityFlag = visibility === "public" ? "--public" : "--private";
  await execFileAsync("gh", ["repo", "create", `${owner}/${repoName}`, visibilityFlag, "--clone=false"], {
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function cloneGithubRepo(githubUrl: string, localPath: string) {
  await execFileAsync("git", ["clone", githubUrl, localPath], { maxBuffer: 10 * 1024 * 1024 });
}

export async function openTraeApp(traeAppName: string, localPath: string) {
  if (process.platform === "darwin") {
    await execFileAsync("open", ["-a", traeAppName, localPath], { maxBuffer: 10 * 1024 * 1024 });
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", traeAppName, localPath], { maxBuffer: 10 * 1024 * 1024 });
    return;
  }

  throw new Error("Opening Trae is only supported on macOS and Windows");
}

async function ensureTraeOpenSupported() {
  if (process.platform === "darwin") {
    await ensureCommandAvailable("open");
    return;
  }

  if (process.platform === "win32") {
    await ensureCommandAvailable("cmd");
    return;
  }

  throw new Error("Opening Trae is only supported on macOS and Windows");
}

async function prepareWorkspaceCreation(input: CreateWorkspaceInput) {
  const authStatus = await checkGithubAuthStatus();
  if (!authStatus.authorized) {
    throw new GithubAuthRequiredError(authStatus.message || "请先授权 GitHub");
  }

  const githubOwner = normalizeOwner(input.githubOwner || authStatus.accountName || "");
  if (!githubOwner) {
    throw new Error("githubOwner is required");
  }

  await ensureCommandAvailable("gh");
  if (input.cloneEnabled) {
    await ensureCommandAvailable("git");
  }
  if (input.openTraeEnabled) {
    await ensureTraeOpenSupported();
  }

  return { githubOwner };
}

function shouldBackfillValue(value: string) {
  return !value.trim();
}

async function backfillWorkspaceProject(
  project: WorkspaceProject,
  targetRecord: CreateWorkspaceTargetRecord | undefined,
): Promise<WorkspaceProjectBackfillResult | null> {
  if (!targetRecord) {
    return null;
  }

  const nextGithubUrl = shouldBackfillValue(targetRecord.githubUrl) ? project.githubUrl : undefined;
  const nextBranchOrFolder = shouldBackfillValue(targetRecord.branchOrFolder) ? "main" : undefined;

  if (!nextGithubUrl && !nextBranchOrFolder) {
    return {
      repoName: project.repoName,
      recordId: targetRecord.recordId,
      status: "skipped",
      message: "字段已有值，未执行回填。",
    };
  }

  try {
    await submitTaskRecord({
      recordId: targetRecord.recordId,
      githubUrl: nextGithubUrl,
      branchOrFolder: nextBranchOrFolder,
    });
    await updateStoredTaskRecord({
      recordId: targetRecord.recordId,
      githubUrl: nextGithubUrl,
      branchOrFolder: nextBranchOrFolder,
    });
    return {
      repoName: project.repoName,
      recordId: targetRecord.recordId,
      status: "updated",
      githubUrl: nextGithubUrl,
      branchOrFolder: nextBranchOrFolder,
    };
  } catch (error) {
    return {
      repoName: project.repoName,
      recordId: targetRecord.recordId,
      status: "failed",
      githubUrl: nextGithubUrl,
      branchOrFolder: nextBranchOrFolder,
      message: error instanceof Error ? error.message : "回填失败",
    };
  }
}

async function persistWorkspaceProject(project: WorkspaceProject) {
  await writeWorkspaceMetadata(project);
  await appendWorkspaceProject(project);
  return project;
}

async function createWorkspaceProjectWithOwner(input: CreateWorkspaceInput, githubOwner: string, targetRecord?: CreateWorkspaceTargetRecord): Promise<WorkspaceProject> {
  const repoName = normalizeRepoName(input.repoName);
  if (!repoName) {
    throw new Error("repoName is required");
  }

  const { localRoot, localPath, githubUrl } = buildWorkspacePaths(input, repoName, githubOwner);

  await mkdir(localRoot, { recursive: true });
  if (input.cloneEnabled) {
    await ensurePathMissing(localPath);
  }

  await createGithubRepo(githubOwner, repoName, input.visibility);

  if (input.cloneEnabled) {
    await cloneGithubRepo(githubUrl, localPath);
  }

  let traeOpened = false;
  let status: WorkspaceProjectStatus = "success";
  let errorMessage: string | undefined;

  if (input.openTraeEnabled) {
    try {
      await openTraeApp(input.traeAppName, input.cloneEnabled ? localPath : localRoot);
      traeOpened = true;
    } catch (error) {
      status = "partial_success";
      errorMessage = error instanceof Error ? error.message : "Failed to open Trae";
    }
  }

  const project: WorkspaceProject = {
    workspaceId: buildWorkspaceProjectId(),
    taskId: input.taskId,
    recordId: targetRecord?.recordId ?? "",
    uid: "",
    repoName,
    githubOwner,
    githubUrl,
    localPath,
    currentBranch: input.cloneEnabled ? "main" : "",
    metadataPath: input.cloneEnabled ? buildWorkspaceMetadataPath(localPath) : "",
    visibility: input.visibility,
    cloneEnabled: input.cloneEnabled,
    traeOpened,
    traeAppName: input.traeAppName,
    status,
    createdAt: new Date().toISOString(),
    errorMessage,
  };

  return persistWorkspaceProject(project);
}

export async function createWorkspaceProject(input: CreateWorkspaceInput): Promise<WorkspaceProject> {
  const { githubOwner } = await prepareWorkspaceCreation(input);
  return createWorkspaceProjectWithOwner(input, githubOwner, input.targetRecord);
}

export async function createWorkspaceProjectsBatch(input: CreateWorkspaceBatchInput): Promise<WorkspaceProjectBatchResult> {
  const repoNames = buildBatchRepoNames(input.repoNames);
  const baseInput: Omit<CreateWorkspaceInput, "repoName"> = {
    taskId: input.taskId,
    githubOwner: input.githubOwner,
    visibility: input.visibility,
    localRoot: input.localRoot,
    cloneEnabled: input.cloneEnabled,
    openTraeEnabled: input.openTraeEnabled,
    traeAppName: input.traeAppName,
  };

  const { githubOwner } = await prepareWorkspaceCreation({ ...baseInput, repoName: repoNames[0] });
  const targetRecords = input.targetRecords ?? [];
  const results = await Promise.allSettled(
    repoNames.map((repoName, index) => createWorkspaceProjectWithOwner({ ...baseInput, repoName }, githubOwner, targetRecords[index])),
  );

  const projects: WorkspaceProject[] = [];
  const failedItems: WorkspaceProjectBatchResult["failedItems"] = [];
  const backfillResults: WorkspaceProjectBackfillResult[] = [];
  const successfulProjectsByIndex = new Map<number, WorkspaceProject>();

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      projects.push(result.value);
      successfulProjectsByIndex.set(index, result.value);
      return;
    }

    failedItems.push({
      repoName: repoNames[index],
      error: result.reason instanceof Error ? result.reason.message : "Create workspace failed",
    });
  });

  for (let index = 0; index < targetRecords.length; index += 1) {
    const project = successfulProjectsByIndex.get(index);
    if (!project) {
      continue;
    }

    const backfillResult = await backfillWorkspaceProject(project, targetRecords[index]);
    if (backfillResult) {
      backfillResults.push(backfillResult);
    }
  }

  for (const project of projects) {
    await writeWorkspaceMetadata(project);
    await appendWorkspaceProject(project);
  }

  return {
    projects,
    failedItems,
    backfillResults,
    successCount: projects.length,
    failureCount: failedItems.length,
  };
}
