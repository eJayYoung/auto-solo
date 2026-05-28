import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULT_MODEL, DEFAULT_TRAE_APP_NAME } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { submitTaskRecord } from "@/lib/services/feishu-base";
import { buildWorkspaceProjectId } from "@/lib/services/github-workspace";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import {
  buildFallbackPromptResult,
  generateBugFixPrompt,
  generateFeatureIterationPrompt,
  generateInitialSoloPrompt,
} from "@/lib/services/solo-prompt-generation";
import type { EvaluationConfidence, SoloPromptResult, SoloRound, SoloSession, TaskRecordSubmitInput } from "@/lib/types";

const execFileAsync = promisify(execFile);
const maxDiffChars = 24_000;

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

type SoloRoundScore = {
  taskCompleted: "完成了任务" | "未完成任务";
  productSatisfaction: "满意" | "不满意";
  processSatisfaction: "满意" | "不满意";
  combinedSatisfaction: "满意" | "不满意";
  productUnsatisfiedReason: string;
  processUnsatisfiedReason: string;
  combinedUnsatisfiedReason: string;
  evidence: string[];
  confidence: EvaluationConfidence;
};

function buildSessionId() {
  return `SOLO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRoundId() {
  return `ROUND-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function isRepoCloned(repoPath: string) {
  try {
    await access(path.join(repoPath, ".git"), fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function toSoloSession(session: {
  sessionId: string;
  workspaceId: string;
  taskId: string;
  repoName: string;
  githubUrl: string;
  localPath: string;
  repoPath: string;
  diffRootPath: string;
  businessDomain: string;
  status: SoloSession["status"];
  currentRound: number;
  maxRounds: number;
  createdAt: Date;
  updatedAt: Date;
  workspaceProject?: { cloneEnabled: boolean; traeOpened: boolean };
  rounds?: Array<Parameters<typeof toSoloRound>[0]>;
}): SoloSession {
  return {
    sessionId: session.sessionId,
    workspaceId: session.workspaceId,
    taskId: session.taskId,
    repoName: session.repoName,
    githubUrl: session.githubUrl,
    localPath: session.localPath,
    repoPath: session.repoPath,
    diffRootPath: session.diffRootPath,
    businessDomain: session.businessDomain,
    status: session.status,
    currentRound: session.currentRound,
    maxRounds: session.maxRounds,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    repoCloned: session.workspaceProject?.cloneEnabled,
    traeOpened: session.workspaceProject?.traeOpened,
    rounds: session.rounds?.map(toSoloRound),
  };
}

function toSoloRound(round: {
  roundId: string;
  sessionId: string;
  recordId: string;
  roundNumber: number;
  traeSessionId: string;
  userPrompt: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  taskCompleted: string;
  processSatisfaction: string;
  productUnsatisfiedReason: string;
  processUnsatisfiedReason: string;
  combinedUnsatisfiedReason: string;
  githubUrl: string;
  branchOrFolder: string;
  screenshotPath: string;
  logsText: string;
  gitStatusText: string;
  gitDiffText: string;
  diffFilePath: string;
  artifactSummary: string;
  nextPrompt: string;
  scoreStatus: string;
  scoreError: string;
  scoreEvidence: string;
  scoreConfidence: EvaluationConfidence | null;
  importStatus: SoloRound["importStatus"];
  importError: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SoloRound {
  return {
    roundId: round.roundId,
    sessionId: round.sessionId,
    recordId: round.recordId,
    roundNumber: round.roundNumber,
    traeSessionId: round.traeSessionId,
    userPrompt: round.userPrompt,
    taskType: round.taskType,
    businessDomain: round.businessDomain,
    modifyScope: round.modifyScope,
    taskCompleted: round.taskCompleted,
    processSatisfaction: round.processSatisfaction,
    productUnsatisfiedReason: round.productUnsatisfiedReason,
    processUnsatisfiedReason: round.processUnsatisfiedReason,
    combinedUnsatisfiedReason: round.combinedUnsatisfiedReason,
    githubUrl: round.githubUrl,
    branchOrFolder: round.branchOrFolder,
    screenshotPath: round.screenshotPath,
    logsText: round.logsText,
    gitStatusText: round.gitStatusText,
    gitDiffText: round.gitDiffText,
    diffFilePath: round.diffFilePath,
    artifactSummary: round.artifactSummary,
    nextPrompt: round.nextPrompt,
    scoreStatus: round.scoreStatus,
    scoreError: round.scoreError,
    scoreEvidence: parseJsonArray(round.scoreEvidence),
    scoreConfidence: round.scoreConfidence ?? undefined,
    importStatus: round.importStatus,
    importError: round.importError,
    submittedAt: round.submittedAt?.toISOString(),
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
  };
}

function buildCombinedReason(productUnsatisfiedReason: string, processUnsatisfiedReason: string) {
  const product = productUnsatisfiedReason.trim();
  const process = processUnsatisfiedReason.trim();
  if (!product && !process) {
    return "";
  }
  return `产物不满意：${product || "无"}\n过程不满意：${process || "无"}`;
}

function buildDiffRootPath(project: { repoName: string }) {
  return path.join(process.cwd(), "workspace", project.repoName, "diff");
}

function normalizeApiUrl(baseUrl: string, apiPath: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildCandidateApiPaths(apiPath: string) {
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (normalizedPath.startsWith("/v1/")) {
    return [normalizedPath];
  }
  if (normalizedPath === "/chat/completions") {
    return [normalizedPath, `/v1${normalizedPath}`];
  }
  return [normalizedPath, `/v1${normalizedPath}`];
}

function parseScore(content: string): SoloRoundScore {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fencedMatch?.[1] ?? trimmed;
  const payload = JSON.parse(raw) as Partial<SoloRoundScore>;
  const taskCompleted = payload.taskCompleted === "完成了任务" ? "完成了任务" : "未完成任务";
  const productSatisfaction = taskCompleted === "未完成任务" ? "不满意" : payload.productSatisfaction === "满意" ? "满意" : "不满意";
  const processSatisfaction = payload.processSatisfaction === "满意" ? "满意" : "不满意";
  const combinedSatisfaction = productSatisfaction === "满意" && processSatisfaction === "满意" ? "满意" : "不满意";
  const productUnsatisfiedReason = typeof payload.productUnsatisfiedReason === "string" ? payload.productUnsatisfiedReason.trim() : "";
  const processUnsatisfiedReason = typeof payload.processUnsatisfiedReason === "string" ? payload.processUnsatisfiedReason.trim() : "";
  const evidence = Array.isArray(payload.evidence) ? payload.evidence.filter((item): item is string => typeof item === "string") : [];
  const confidence = payload.confidence === "high" || payload.confidence === "medium" || payload.confidence === "low" ? payload.confidence : "low";

  return {
    taskCompleted,
    productSatisfaction,
    processSatisfaction,
    combinedSatisfaction,
    productUnsatisfiedReason: combinedSatisfaction === "满意" ? "" : productUnsatisfiedReason,
    processUnsatisfiedReason: combinedSatisfaction === "满意" ? "" : processUnsatisfiedReason,
    combinedUnsatisfiedReason: combinedSatisfaction === "满意" ? "" : buildCombinedReason(productUnsatisfiedReason, processUnsatisfiedReason),
    evidence,
    confidence,
  };
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n\n[内容已截断，原始长度 ${value.length} 字符]`;
}

async function runGit(cwd: string, args: string[]) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    if (error instanceof Error) {
      return `git ${args.join(" ")} failed: ${error.message}`;
    }
    return `git ${args.join(" ")} failed`;
  }
}

async function captureRoundGitState(repoPath: string) {
  if (!(await pathExists(repoPath))) {
    throw new Error("本地仓库不存在，请先 Clone 到本地");
  }
  const status = await runGit(repoPath, ["status", "--short"]);
  const unstagedDiff = await runGit(repoPath, ["diff"]);
  const stagedDiff = await runGit(repoPath, ["diff", "--cached"]);
  const gitDiffText = truncateText(["# Unstaged Diff", unstagedDiff || "无", "# Staged Diff", stagedDiff || "无"].join("\n\n"), maxDiffChars);

  return {
    gitStatusText: status || "无改动",
    gitDiffText,
  };
}

function buildScorePrompt(session: SoloSession, round: SoloRound, gitStatusText: string, gitDiffText: string) {
  const history = (session.rounds ?? [])
    .filter((item) => item.roundNumber < round.roundNumber)
    .map((item) => `第 ${item.roundNumber} 轮：${item.taskType}\nPrompt: ${item.userPrompt}\n任务完成: ${item.taskCompleted}\n满意度: ${item.processSatisfaction}\n不满意原因: ${item.combinedUnsatisfiedReason}`)
    .join("\n\n");

  return `请根据以下 Solo Coder 本轮执行结果，判断任务是否完成、产物是否满意、过程是否满意，并生成可直接写入表单的标注草稿。

评分要求：
- 只输出 JSON，不要输出 Markdown。
- JSON 格式：{"taskCompleted":"完成了任务|未完成任务","productSatisfaction":"满意|不满意","processSatisfaction":"满意|不满意","combinedSatisfaction":"满意|不满意","productUnsatisfiedReason":"...","processUnsatisfiedReason":"...","combinedUnsatisfiedReason":"...","evidence":["..."],"confidence":"high|medium|low"}
- 如果任务未完成，productSatisfaction 必须为“不满意”。
- 产物是否满意主要根据本轮 Prompt 与 Git Diff 的匹配度判断，不要因为 Prompt 外的额外期望判为不满意。
- 过程是否满意结合日志、改动范围、是否有明显反复/偏航/未收敛迹象判断。
- 如果不满意，原因必须先评价本轮结果，不要只写历史问题；尽量包含范围/对象、现象证据、与需求偏差、影响中的至少两类信息。
- 如果 diff、日志或证据不足以判断，请给 low 置信度，并在 evidence 中说明缺失信息。

会话信息：
仓库: ${session.repoName}
GitHub: ${session.githubUrl}
本地路径: ${session.repoPath}

历史轮次：
${history || "无"}

本轮信息：
第 ${round.roundNumber} 轮
任务类型: ${round.taskType}
业务领域: ${round.businessDomain}
修改范围: ${round.modifyScope}
User Prompt:
${round.userPrompt}

用户填写的执行信息：
Trae Session ID: ${round.traeSessionId}
产物摘要: ${round.artifactSummary}
日志轨迹:
${round.logsText}

Git Status:
${gitStatusText}

Git Diff:
${gitDiffText}`;
}

async function requestRoundScore(session: SoloSession, round: SoloRound, gitStatusText: string, gitDiffText: string): Promise<SoloRoundScore> {
  const settings = await readUserSettings();
  if (!settings.modelKey.trim()) {
    throw new Error("请先在设置中填写 Model Key");
  }

  const apiPaths = buildCandidateApiPaths(settings.modelApiPath);
  let lastError: Error | null = null;

  for (const apiPath of apiPaths) {
    const url = normalizeApiUrl(settings.modelBaseUrl, apiPath);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.modelKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: settings.model || DEFAULT_MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: "你是 Solo Coder 轮次评分助手，只输出 JSON。" },
            { role: "user", content: buildScorePrompt(session, round, gitStatusText, gitDiffText) },
          ],
        }),
        cache: "no-store",
      });
    } catch (error) {
      lastError = new Error(error instanceof Error ? error.message : String(error));
      continue;
    }

    const rawText = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(rawText) as OpenAIChatResponse;
    } catch {
      lastError = new Error(`模型接口返回非 JSON 响应：${rawText.slice(0, 160)}`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`模型接口请求失败（${response.status}）: ${payload.error?.message || rawText.slice(0, 240)}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("模型返回为空");
    }

    try {
      return parseScore(content);
    } catch {
      throw new Error("模型返回非 JSON 或字段不完整");
    }
  }

  throw lastError ?? new Error("模型接口调用失败，请检查设置");
}

export async function createSoloSessionFromWorkspace(workspaceId: string): Promise<SoloSession> {
  const project = await prisma.workspaceProject.findUnique({ where: { workspaceId } });
  if (!project) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const diffRootPath = buildDiffRootPath(project);
  await mkdir(diffRootPath, { recursive: true });

  const session = await prisma.soloSession.upsert({
    where: { workspaceId },
    create: {
      sessionId: buildSessionId(),
      workspaceId: project.workspaceId,
      taskId: project.taskId,
      repoName: project.repoName,
      githubUrl: project.githubUrl,
      localPath: project.localPath,
      repoPath: project.localPath,
      diffRootPath,
      currentRound: 0,
      maxRounds: 5,
      status: "draft",
    },
    update: {
      taskId: project.taskId,
      repoName: project.repoName,
      githubUrl: project.githubUrl,
      localPath: project.localPath,
      repoPath: project.localPath,
      diffRootPath,
    },
    include: { workspaceProject: true, rounds: { orderBy: { roundNumber: "asc" } } },
  });

  return toSoloSession(session);
}

export async function createSoloTasks(repoNames: string[], githubOwner: string): Promise<SoloSession[]> {
  const normalizedRepoNames = repoNames.map((repoName) => repoName.trim()).filter(Boolean);
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

  const createdSessions = [];
  for (const repoName of normalizedRepoNames) {
    const workspaceId = buildWorkspaceProjectId();
    const githubUrl = `https://github.com/${githubOwner}/${repoName}`;
    const localPath = path.join(process.cwd(), "workspace", repoName, "repo");
    const diffRootPath = buildDiffRootPath({ repoName });
    await mkdir(diffRootPath, { recursive: true });

    const session = await prisma.$transaction(async (tx) => {
      await tx.workspaceProject.create({
        data: {
          workspaceId,
          taskId: "SOLO",
          repoName,
          githubOwner,
          githubUrl,
          localPath,
          currentBranch: "main",
          visibility: "public",
          cloneEnabled: true,
          traeOpened: false,
          traeAppName: "Trae CN",
          status: "success",
        },
      });

      return tx.soloSession.create({
        data: {
          sessionId: buildSessionId(),
          workspaceId,
          taskId: "SOLO",
          repoName,
          githubUrl,
          localPath,
          repoPath: localPath,
          diffRootPath,
          currentRound: 0,
          maxRounds: 5,
          status: "draft",
        },
        include: { workspaceProject: true, rounds: { orderBy: { roundNumber: "asc" } } },
      });
    });

    createdSessions.push(toSoloSession(session));
  }

  return createdSessions;
}

export async function readSoloSession(sessionId: string): Promise<SoloSession | null> {
  const session = await prisma.soloSession.findUnique({
    where: { sessionId },
    include: { workspaceProject: true, rounds: { orderBy: { roundNumber: "asc" } } },
  });
  return session ? toSoloSession(session) : null;
}

export async function readSoloSessions(): Promise<SoloSession[]> {
  const sessions = await prisma.soloSession.findMany({
    orderBy: { updatedAt: "desc" },
    include: { workspaceProject: true, rounds: { orderBy: { roundNumber: "asc" } } },
  });
  return sessions.map(toSoloSession);
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function cloneSoloSessionRepository(sessionId: string): Promise<SoloSession> {
  const session = await readSoloSession(sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${sessionId}`);
  }
  if (await isRepoCloned(session.repoPath)) {
    throw new Error("本地项目已存在，无需重复 clone");
  }

  await mkdir(path.dirname(session.repoPath), { recursive: true });
  await execFileAsync("git", ["clone", session.githubUrl, session.repoPath], { maxBuffer: 10 * 1024 * 1024 });
  await prisma.workspaceProject.update({ where: { workspaceId: session.workspaceId }, data: { cloneEnabled: true, currentBranch: "main" } });
  const updated = await readSoloSession(sessionId);
  if (!updated) {
    throw new Error(`Solo session not found: ${sessionId}`);
  }
  return updated;
}

export async function openSoloSessionRepositoryWithTrae(sessionId: string): Promise<SoloSession> {
  const session = await readSoloSession(sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${sessionId}`);
  }
  if (!(await pathExists(session.repoPath))) {
    throw new Error("请先 clone 到本地，再用 Trae 打开");
  }

  if (process.platform === "darwin") {
    await execFileAsync("open", ["-a", DEFAULT_TRAE_APP_NAME, session.repoPath], { maxBuffer: 10 * 1024 * 1024 });
  } else if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", DEFAULT_TRAE_APP_NAME, session.repoPath], { maxBuffer: 10 * 1024 * 1024 });
  } else {
    throw new Error("用 Trae 打开仅支持 macOS 和 Windows");
  }

  await prisma.workspaceProject.update({ where: { workspaceId: session.workspaceId }, data: { traeOpened: true } });
  const updated = await readSoloSession(sessionId);
  if (!updated) {
    throw new Error(`Solo session not found: ${sessionId}`);
  }
  return updated;
}

export async function createInitialRound(sessionId: string, prompt?: SoloPromptResult): Promise<SoloRound> {
  const session = await readSoloSession(sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${sessionId}`);
  }
  const round = await prisma.soloRound.create({
    data: {
      roundId: buildRoundId(),
      sessionId,
      roundNumber: 1,
      userPrompt: prompt?.userPrompt ?? "",
      taskType: prompt?.taskType || "0-1代码生成",
      businessDomain: prompt?.businessDomain || session.businessDomain,
      modifyScope: prompt?.modifyScope ?? "",
      githubUrl: session.githubUrl,
      branchOrFolder: "main",
    },
  });
  await prisma.soloSession.update({ where: { sessionId }, data: { currentRound: 1, status: "running", businessDomain: prompt?.businessDomain || session.businessDomain } });
  return toSoloRound(round);
}

export async function generateSoloRoundPrompt(roundId: string): Promise<SoloRound> {
  const roundRecord = await prisma.soloRound.findUnique({ where: { roundId } });
  if (!roundRecord) {
    throw new Error(`Solo round not found: ${roundId}`);
  }
  const session = await readSoloSession(roundRecord.sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${roundRecord.sessionId}`);
  }

  const rounds = session.rounds ?? [];
  const previousRounds = rounds.filter((round) => round.roundNumber < roundRecord.roundNumber);
  const previousRound = previousRounds.at(-1);
  const satisfied = previousRound?.processSatisfaction === "满意" && previousRound.taskCompleted === "完成了任务";
  const taskType = roundRecord.roundNumber === 1 ? "0-1代码生成" : satisfied ? "Feature迭代" : "Bug修复";
  const promptResult = await (
    roundRecord.roundNumber === 1
      ? generateInitialSoloPrompt(session)
      : satisfied
        ? generateFeatureIterationPrompt(session, previousRounds)
        : generateBugFixPrompt(session, previousRounds)
  ).catch(() => buildFallbackPromptResult(taskType, session.repoName));

  const updated = await prisma.soloRound.update({
    where: { roundId },
    data: {
      userPrompt: promptResult.userPrompt,
      taskType: promptResult.taskType || taskType,
      businessDomain: promptResult.businessDomain || session.businessDomain,
      modifyScope: promptResult.modifyScope,
      githubUrl: session.githubUrl,
      branchOrFolder: roundRecord.branchOrFolder || "main",
      nextPrompt: "",
    },
  });
  await prisma.soloSession.update({ where: { sessionId: session.sessionId }, data: { businessDomain: promptResult.businessDomain || session.businessDomain, currentRound: updated.roundNumber } });
  return toSoloRound(updated);
}

export async function updateSoloRound(roundId: string, input: Partial<SoloRound>): Promise<SoloRound> {
  const combinedUnsatisfiedReason = input.combinedUnsatisfiedReason ?? buildCombinedReason(input.productUnsatisfiedReason ?? "", input.processUnsatisfiedReason ?? "");
  const round = await prisma.soloRound.update({
    where: { roundId },
    data: {
      recordId: input.recordId,
      traeSessionId: input.traeSessionId,
      userPrompt: input.userPrompt,
      taskType: input.taskType,
      businessDomain: input.businessDomain,
      modifyScope: input.modifyScope,
      taskCompleted: input.taskCompleted,
      processSatisfaction: input.processSatisfaction,
      productUnsatisfiedReason: input.productUnsatisfiedReason,
      processUnsatisfiedReason: input.processUnsatisfiedReason,
      combinedUnsatisfiedReason,
      githubUrl: input.githubUrl,
      branchOrFolder: input.branchOrFolder,
      screenshotPath: input.screenshotPath,
      logsText: input.logsText,
      gitStatusText: input.gitStatusText,
      gitDiffText: input.gitDiffText,
      diffFilePath: input.diffFilePath,
      artifactSummary: input.artifactSummary,
      nextPrompt: input.nextPrompt,
    },
  });
  return toSoloRound(round);
}

async function commitRoundChanges(repoPath: string, roundNumber: number) {
  if (!(await isRepoCloned(repoPath))) {
    return;
  }

  const status = await runGit(repoPath, ["status", "--porcelain"]);
  if (!status || status.startsWith("git status --porcelain failed:")) {
    return;
  }

  await execFileAsync("git", ["add", "-A"], { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 });
  await execFileAsync("git", ["commit", "-m", `solo: complete round ${roundNumber}`], { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 });
}

export async function createNextRound(roundId: string): Promise<SoloRound> {
  const current = await prisma.soloRound.findUnique({ where: { roundId } });
  if (!current) {
    throw new Error(`Solo round not found: ${roundId}`);
  }
  const session = await readSoloSession(current.sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${current.sessionId}`);
  }
  const rounds = session.rounds ?? [];
  const maxRoundNumber = rounds.reduce((max, round) => Math.max(max, round.roundNumber), 0);
  if (maxRoundNumber >= session.maxRounds) {
    throw new Error("最多只能生成五轮 Prompt");
  }
  const satisfied = current.processSatisfaction === "满意" && current.taskCompleted === "完成了任务";
  const nextRoundNumber = maxRoundNumber + 1;
  await commitRoundChanges(session.repoPath, current.roundNumber);

  const round = await prisma.soloRound.create({
    data: {
      roundId: buildRoundId(),
      sessionId: session.sessionId,
      roundNumber: nextRoundNumber,
      taskType: satisfied ? "Feature迭代" : "Bug修复",
      businessDomain: session.businessDomain,
      githubUrl: session.githubUrl,
      branchOrFolder: "main",
    },
  });
  await prisma.soloSession.update({ where: { sessionId: session.sessionId }, data: { currentRound: nextRoundNumber } });
  return toSoloRound(round);
}

export async function scoreSoloRound(roundId: string): Promise<SoloRound> {
  const roundRecord = await prisma.soloRound.findUnique({ where: { roundId } });
  if (!roundRecord) {
    throw new Error(`Solo round not found: ${roundId}`);
  }
  if (!roundRecord.userPrompt.trim()) {
    throw new Error("请先生成 Prompt，再进行一键评分");
  }
  const session = await readSoloSession(roundRecord.sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${roundRecord.sessionId}`);
  }

  await prisma.soloRound.update({ where: { roundId }, data: { scoreStatus: "scoring", scoreError: "" } });
  const { gitStatusText, gitDiffText } = await captureRoundGitState(session.repoPath);
  const round = toSoloRound({ ...roundRecord, gitStatusText, gitDiffText });

  try {
    const score = await requestRoundScore(session, round, gitStatusText, gitDiffText);
    const updated = await prisma.soloRound.update({
      where: { roundId },
      data: {
        taskCompleted: score.taskCompleted,
        processSatisfaction: score.combinedSatisfaction,
        productUnsatisfiedReason: score.productUnsatisfiedReason,
        processUnsatisfiedReason: score.processUnsatisfiedReason,
        combinedUnsatisfiedReason: score.combinedUnsatisfiedReason,
        gitStatusText,
        gitDiffText,
        scoreStatus: "scored",
        scoreError: "",
        scoreEvidence: JSON.stringify(score.evidence),
        scoreConfidence: score.confidence,
      },
    });
    return toSoloRound(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "评分失败";
    const updated = await prisma.soloRound.update({
      where: { roundId },
      data: { gitStatusText, gitDiffText, scoreStatus: "failed", scoreError: message },
    });
    throw new Error(toSoloRound(updated).scoreError);
  }
}

export async function deleteSoloRound(sessionId: string, roundId: string): Promise<SoloSession> {
  await prisma.$transaction(async (tx) => {
    const session = await tx.soloSession.findUnique({ where: { sessionId } });
    if (!session) {
      throw new Error(`Solo session not found: ${sessionId}`);
    }
    const target = await tx.soloRound.findUnique({ where: { roundId } });
    if (!target || target.sessionId !== sessionId) {
      throw new Error(`Solo round not found: ${roundId}`);
    }

    await tx.soloRound.delete({ where: { roundId } });
    const remaining = await tx.soloRound.findMany({ where: { sessionId }, orderBy: { roundNumber: "asc" } });
    const currentStillExists = remaining.some((round) => round.roundNumber === session.currentRound);
    const previous = remaining.filter((round) => round.roundNumber < target.roundNumber).at(-1);
    const next = remaining.find((round) => round.roundNumber > target.roundNumber);
    const currentRound = remaining.length === 0 ? 0 : currentStillExists && session.currentRound !== target.roundNumber ? session.currentRound : (previous ?? next ?? remaining.at(-1))?.roundNumber ?? 0;

    await tx.soloSession.update({ where: { sessionId }, data: { currentRound, status: remaining.length === 0 ? "draft" : session.status } });
  });

  const session = await readSoloSession(sessionId);
  if (!session) {
    throw new Error(`Solo session not found: ${sessionId}`);
  }
  return session;
}

export function buildTaskRecordSubmitInput(round: SoloRound): TaskRecordSubmitInput {
  return {
    recordId: round.recordId,
    traeSessionId: round.traeSessionId,
    round: round.roundNumber,
    userPrompt: round.userPrompt,
    taskType: round.taskType,
    businessDomain: round.businessDomain,
    modifyScope: round.modifyScope,
    githubUrl: round.githubUrl,
    branchOrFolder: round.branchOrFolder,
    logs: round.logsText,
    taskCompleted: round.taskCompleted,
    processSatisfaction: round.processSatisfaction,
    unsatisfiedReason: round.combinedUnsatisfiedReason,
  };
}

export async function importSoloRound(roundId: string) {
  const roundRecord = await prisma.soloRound.findUnique({ where: { roundId } });
  if (!roundRecord) {
    throw new Error(`Solo round not found: ${roundId}`);
  }
  const round = toSoloRound(roundRecord);
  if (!round.recordId.trim()) {
    throw new Error("导入飞书前需要先填写 recordId");
  }

  await prisma.soloRound.update({ where: { roundId }, data: { importStatus: "importing", importError: "" } });
  try {
    await submitTaskRecord(buildTaskRecordSubmitInput(round));
    const updated = await prisma.soloRound.update({
      where: { roundId },
      data: { importStatus: "imported", submittedAt: new Date(), importError: "" },
    });
    return toSoloRound(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败";
    await prisma.soloRound.update({ where: { roundId }, data: { importStatus: "failed", importError: message } });
    throw error;
  }
}

export async function importSoloSessionRounds(sessionId: string) {
  const rounds = await prisma.soloRound.findMany({ where: { sessionId, importStatus: { not: "imported" } }, orderBy: { roundNumber: "asc" } });
  const imported: SoloRound[] = [];
  for (const round of rounds) {
    imported.push(await importSoloRound(round.roundId));
  }
  if (rounds.length > 0) {
    await prisma.soloSession.update({ where: { sessionId }, data: { status: "imported" } });
  }
  return imported;
}
