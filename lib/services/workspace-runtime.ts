import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "../db";
import type { WorkspaceRun, WorkspaceRunSubmitInput } from "@/lib/types";

const execFileAsync = promisify(execFile);
const workspaceMetadataFileName = ".auto-solo.json";

type WorkspaceMetadata = {
  workspaceId: string;
  taskId: string;
  recordId: string;
  uid: string;
  githubUrl: string;
  expectedRepoName: string;
};

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function toWorkspaceRun(run: {
  runId: string;
  workspaceId: string;
  recordId: string;
  uid: string;
  status: WorkspaceRun["status"];
  repoName: string;
  githubUrl: string;
  branchName: string;
  localPath: string;
  screenshotPath: string;
  screenshotMimeType: string;
  traeExportPath: string;
  logsText: string;
  artifactSummary: string;
  gitStatusText: string;
  gitDiffText: string;
  diffFilePath: string;
  suggestedTaskCompleted: string;
  aiSuggestedSatisfaction: string;
  aiSuggestedReason: string;
  productUnsatisfiedReason: string;
  processUnsatisfiedReason: string;
  aiEvidence: string;
  aiConfidence: WorkspaceRun["aiConfidence"] | null;
  userFinalSatisfaction: string;
  userFinalReason: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceRun {
  return {
    runId: run.runId,
    workspaceId: run.workspaceId,
    recordId: run.recordId,
    uid: run.uid,
    status: run.status,
    repoName: run.repoName,
    githubUrl: run.githubUrl,
    branchName: run.branchName,
    localPath: run.localPath,
    screenshotPath: run.screenshotPath,
    screenshotMimeType: run.screenshotMimeType,
    traeExportPath: run.traeExportPath,
    logsText: run.logsText,
    artifactSummary: run.artifactSummary,
    gitStatusText: run.gitStatusText,
    gitDiffText: run.gitDiffText,
    diffFilePath: run.diffFilePath,
    suggestedTaskCompleted: run.suggestedTaskCompleted,
    aiSuggestedSatisfaction: run.aiSuggestedSatisfaction,
    aiSuggestedReason: run.aiSuggestedReason,
    productUnsatisfiedReason: run.productUnsatisfiedReason,
    processUnsatisfiedReason: run.processUnsatisfiedReason,
    aiEvidence: parseStringArray(run.aiEvidence),
    aiConfidence: run.aiConfidence ?? undefined,
    userFinalSatisfaction: run.userFinalSatisfaction,
    userFinalReason: run.userFinalReason,
    submittedAt: run.submittedAt?.toISOString(),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function buildRunId() {
  return `RUN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function metadataPathForDirectory(directory: string) {
  return path.join(directory, workspaceMetadataFileName);
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function runGit(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

function buildDiffRootPath(repoName: string) {
  return path.join(process.cwd(), "workspace", repoName, "diff");
}

function buildDiffFilePath(repoName: string, roundNumber = 1) {
  return path.join(buildDiffRootPath(repoName), `round-${roundNumber}.diff`);
}

async function runOptionalGit(cwd: string, args: string[]) {
  try {
    return await runGit(cwd, args);
  } catch (error) {
    return error instanceof Error ? `Git command failed: git ${args.join(" ")}\n${error.message}` : `Git command failed: git ${args.join(" ")}`;
  }
}

async function writeRoundDiff(repoName: string, roundNumber: number | undefined, gitDiffText: string) {
  const diffRootPath = buildDiffRootPath(repoName);
  await mkdir(diffRootPath, { recursive: true });
  const diffFilePath = buildDiffFilePath(repoName, roundNumber ?? 1);
  await writeFile(diffFilePath, gitDiffText.trim() ? `${gitDiffText}\n` : "No git diff changes.\n");
  return diffFilePath;
}

export async function readWorkspaceMetadata(directory = process.cwd()): Promise<WorkspaceMetadata> {
  const payload = JSON.parse(await readFile(metadataPathForDirectory(directory), "utf8")) as Partial<WorkspaceMetadata>;
  if (!payload.workspaceId) {
    throw new Error(".auto-solo.json is missing workspaceId");
  }

  return {
    workspaceId: payload.workspaceId,
    taskId: payload.taskId ?? "",
    recordId: payload.recordId ?? "",
    uid: payload.uid ?? "",
    githubUrl: payload.githubUrl ?? "",
    expectedRepoName: payload.expectedRepoName ?? "",
  };
}

export async function writeWorkspaceMetadataFile(directory: string, metadata: WorkspaceMetadata) {
  await writeFile(metadataPathForDirectory(directory), `${JSON.stringify(metadata, null, 2)}\n`);
}

export async function bindWorkspaceDirectory(directory: string, workspaceId: string) {
  const project = await prisma.workspaceProject.findUnique({ where: { workspaceId } });
  if (!project) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const metadata = {
    workspaceId: project.workspaceId,
    taskId: project.taskId,
    recordId: project.recordId,
    uid: project.uid,
    githubUrl: project.githubUrl,
    expectedRepoName: project.repoName,
  };
  await writeWorkspaceMetadataFile(directory, metadata);
  await prisma.workspaceProject.update({
    where: { workspaceId },
    data: {
      localPath: directory,
      metadataPath: metadataPathForDirectory(directory),
    },
  });
  return metadata;
}

async function readOptionalWorkspaceMetadata(directory = process.cwd()): Promise<Partial<WorkspaceMetadata>> {
  try {
    return await readWorkspaceMetadata(directory);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as NodeJS.ErrnoException).code : "";
    if (code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function collectWorkspaceRuntime(directory = process.cwd(), input: Partial<WorkspaceRunSubmitInput> = {}): Promise<WorkspaceRunSubmitInput> {
  const metadata = await readOptionalWorkspaceMetadata(directory);
  const githubUrl = input.githubUrl || metadata.githubUrl || (await runGit(directory, ["remote", "get-url", "origin"]));
  const branchName = input.branchName || (await runGit(directory, ["branch", "--show-current"])) || "main";
  const repoName = input.repoName || metadata.expectedRepoName || path.basename(directory);
  const gitStatusText = input.gitStatusText ?? (await runOptionalGit(directory, ["status", "--short"]));
  const gitDiffStat = await runOptionalGit(directory, ["diff", "--stat"]);
  const gitDiffBody = input.gitDiffText ?? (await runOptionalGit(directory, ["diff", "--"]));
  const gitDiffText = gitDiffStat.trim() ? `${gitDiffStat}\n\n${gitDiffBody}` : gitDiffBody;
  const diffFilePath = input.diffFilePath || (await writeRoundDiff(repoName, input.roundNumber, gitDiffText));

  return {
    workspaceId: input.workspaceId || metadata.workspaceId,
    recordId: input.recordId || metadata.recordId,
    uid: input.uid || metadata.uid,
    repoName,
    githubUrl,
    branchName,
    localPath: path.resolve(directory),
    screenshotPath: input.screenshotPath ?? "",
    screenshotMimeType: input.screenshotMimeType ?? "",
    traeExportPath: input.traeExportPath ?? "",
    logsText: input.logsText ?? "",
    artifactSummary: input.artifactSummary ?? "",
    gitStatusText,
    gitDiffText,
    diffFilePath,
    roundNumber: input.roundNumber,
  };
}

export async function captureWorkspaceScreenshot(directory = process.cwd()) {
  const outputDirectory = path.join(directory, ".auto-solo");
  await mkdir(outputDirectory, { recursive: true });
  const screenshotPath = path.join(outputDirectory, "latest-run.png");

  if (process.platform !== "darwin") {
    return "";
  }

  await execFileAsync("screencapture", ["-x", screenshotPath], { maxBuffer: 10 * 1024 * 1024 });
  return (await pathExists(screenshotPath)) ? screenshotPath : "";
}

export async function createWorkspaceRun(input: WorkspaceRunSubmitInput): Promise<WorkspaceRun> {
  if (!input.workspaceId) {
    throw new Error("workspaceId is required to create a workspace run");
  }

  const project = await prisma.workspaceProject.findUnique({ where: { workspaceId: input.workspaceId } });
  if (!project) {
    throw new Error(`Workspace not found: ${input.workspaceId}`);
  }

  const created = await prisma.workspaceRun.create({
    data: {
      runId: buildRunId(),
      workspaceId: input.workspaceId,
      recordId: input.recordId || project.recordId,
      uid: input.uid || project.uid,
      status: "collected",
      repoName: input.repoName || project.repoName,
      githubUrl: input.githubUrl || project.githubUrl,
      branchName: input.branchName || project.currentBranch || "main",
      localPath: input.localPath || project.localPath,
      screenshotPath: input.screenshotPath ?? "",
      screenshotMimeType: input.screenshotMimeType ?? "",
      traeExportPath: input.traeExportPath ?? "",
      logsText: input.logsText ?? "",
      artifactSummary: input.artifactSummary ?? "",
      gitStatusText: input.gitStatusText ?? "",
      gitDiffText: input.gitDiffText ?? "",
      diffFilePath: input.diffFilePath ?? "",
    },
  });

  await prisma.workspaceProject.update({
    where: { workspaceId: input.workspaceId },
    data: {
      currentBranch: created.branchName,
      lastCollectedAt: new Date(),
    },
  });

  return toWorkspaceRun(created);
}

export async function readLatestWorkspaceRunsByRecord(): Promise<Record<string, WorkspaceRun>> {
  const runs = await prisma.workspaceRun.findMany({ orderBy: { createdAt: "desc" } });
  return runs.reduce<Record<string, WorkspaceRun>>((acc, run) => {
    if (!acc[run.recordId]) {
      acc[run.recordId] = toWorkspaceRun(run);
    }
    return acc;
  }, {});
}

export async function readWorkspaceRun(runId: string): Promise<WorkspaceRun | null> {
  const run = await prisma.workspaceRun.findUnique({ where: { runId } });
  return run ? toWorkspaceRun(run) : null;
}
