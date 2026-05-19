import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import type { GithubAuthLoginSession, GithubAuthStatus } from "@/lib/types";

const execFileAsync = promisify(execFile);
const sessionTtlMs = 10 * 60 * 1000;
const githubAuthStatusId = "default";

type MutableGithubLoginSession = GithubAuthLoginSession & {
  expiresAt: number;
  processId?: number;
  settled: boolean;
  completedAt?: number;
};

const loginSessions = new Map<string, MutableGithubLoginSession>();

function stripAnsi(value: string) {
  return value.replace(/\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\][^]*(?:|\\)/g, "");
}

function sanitizeOutput(output: string) {
  return stripAnsi(output).trim().slice(-4000);
}

function withCheckedAt(status: GithubAuthStatus): GithubAuthStatus {
  return {
    ...status,
    checkedAt: new Date().toISOString(),
  };
}

async function writeCachedGithubAuthStatus(status: GithubAuthStatus) {
  const nextStatus = withCheckedAt(status);
  await prisma.githubAuthStatus.upsert({
    where: { id: githubAuthStatusId },
    create: {
      id: githubAuthStatusId,
      authorized: nextStatus.authorized,
      message: nextStatus.message ?? null,
      accountName: nextStatus.accountName ?? null,
      checkedAt: nextStatus.checkedAt ? new Date(nextStatus.checkedAt) : new Date(),
    },
    update: {
      authorized: nextStatus.authorized,
      message: nextStatus.message ?? null,
      accountName: nextStatus.accountName ?? null,
      checkedAt: nextStatus.checkedAt ? new Date(nextStatus.checkedAt) : new Date(),
    },
  });
}

export async function readCachedGithubAuthStatus(): Promise<GithubAuthStatus | null> {
  const status = await prisma.githubAuthStatus.findUnique({ where: { id: githubAuthStatusId } });
  if (!status) {
    return null;
  }

  return {
    authorized: status.authorized,
    message: status.message ?? undefined,
    accountName: status.accountName ?? undefined,
    checkedAt: status.checkedAt.toISOString(),
  };
}

function buildInstructions(session: Pick<GithubAuthLoginSession, "verificationUrl" | "userCode">) {
  if (session.verificationUrl && session.userCode) {
    return `访问 ${session.verificationUrl} 并输入验证码 ${session.userCode}，完成授权后点击刷新状态。`;
  }
  if (session.verificationUrl) {
    return `访问 ${session.verificationUrl} 完成授权，完成后点击刷新状态。`;
  }
  return "等待 gh 输出授权地址，完成授权后点击刷新状态。";
}

function parseVerificationUrl(output: string) {
  const cleanOutput = stripAnsi(output);
  const match = cleanOutput.match(/https:\/\/github\.com\/login\/device\S*/i);
  return match?.[0];
}

function parseUserCode(output: string) {
  const cleanOutput = stripAnsi(output);
  const labeledMatch = cleanOutput.match(/(?:one-time\s+code|code|验证码)[:：]?\s*([A-Z0-9-]{4,})/i);
  if (labeledMatch?.[1]) {
    return labeledMatch[1];
  }

  const deviceMatch = cleanOutput.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/);
  if (deviceMatch?.[0]) {
    return deviceMatch[0];
  }

  return undefined;
}

function toPublicSession(session: MutableGithubLoginSession): GithubAuthLoginSession {
  return {
    sessionId: session.sessionId,
    status: session.status,
    verificationUrl: session.verificationUrl,
    userCode: session.userCode,
    instructions: session.instructions,
    output: session.output,
    message: session.message,
  };
}

function updateSessionFromOutput(session: MutableGithubLoginSession, chunk: string) {
  session.output = sanitizeOutput(`${session.output}\n${chunk}`);
  session.verificationUrl = session.verificationUrl ?? parseVerificationUrl(chunk);
  session.userCode = session.userCode ?? parseUserCode(chunk);
  if (session.status === "starting" && session.verificationUrl) {
    session.status = "waiting";
  }
  session.instructions = buildInstructions(session);
}

function completeSession(session: MutableGithubLoginSession, next: Partial<MutableGithubLoginSession>) {
  if (session.settled) {
    return;
  }
  Object.assign(session, next);
  session.settled = true;
  session.completedAt = Date.now();
  session.processId = undefined;
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of loginSessions) {
    const isExpired = session.expiresAt <= now;
    const isOldCompleted = session.completedAt != null && session.completedAt + 60_000 <= now;
    if (isExpired || isOldCompleted) {
      loginSessions.delete(sessionId);
    }
  }
}

export async function checkGithubAuthStatus(): Promise<GithubAuthStatus> {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "status", "-h", "github.com"], { maxBuffer: 10 * 1024 * 1024 });
    const cleanOutput = stripAnsi(stdout);
    const accountName = cleanOutput.match(/Logged in to github\.com account\s+([^\s]+)|已登录账号[:：]?\s*([^\s]+)/i)?.[1] ?? cleanOutput.match(/Logged in to github\.com account\s+([^\s]+)|已登录账号[:：]?\s*([^\s]+)/i)?.[2];
    const status = withCheckedAt({ authorized: true, accountName });
    await writeCachedGithubAuthStatus(status);
    return status;
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub auth status check failed";
    const status = withCheckedAt({ authorized: false, message });
    await writeCachedGithubAuthStatus(status);
    return status;
  }
}

export async function logoutGithubAuth(): Promise<GithubAuthStatus> {
  try {
    const { stdout, stderr } = await execFileAsync("gh", ["auth", "logout", "-h", "github.com"], {
      env: { ...process.env, GH_PROMPT_DISABLED: "1" },
      maxBuffer: 10 * 1024 * 1024,
    });
    const message = sanitizeOutput(`${stdout}\n${stderr}`) || "已退出 GitHub 登录。";
    const status = withCheckedAt({ authorized: false, message });
    await writeCachedGithubAuthStatus(status);
    return status;
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub logout failed";
    throw new Error(message);
  }
}

export function getGithubLoginSession(sessionId: string): GithubAuthLoginSession | undefined {
  pruneExpiredSessions();
  const session = loginSessions.get(sessionId);
  if (!session) {
    return undefined;
  }
  if (session.expiresAt <= Date.now()) {
    session.status = "expired";
    session.message = "GitHub 授权会话已过期，请重新发起授权。";
    session.instructions = session.message;
  }
  return toPublicSession(session);
}

export async function startGithubLoginSession(): Promise<GithubAuthLoginSession> {
  pruneExpiredSessions();

  const authStatus = await checkGithubAuthStatus();
  if (authStatus.authorized) {
    return {
      sessionId: randomUUID(),
      status: "authorized",
      instructions: "当前 gh 已授权，无需重复登录。",
      output: "",
      message: "已授权",
    };
  }

  const sessionId = randomUUID();
  const session: MutableGithubLoginSession = {
    sessionId,
    status: "starting",
    instructions: "正在启动 GitHub CLI 授权。",
    output: "",
    expiresAt: Date.now() + sessionTtlMs,
    settled: false,
  };
  loginSessions.set(sessionId, session);

  const child = spawn("gh", ["auth", "login", "-h", "github.com", "--scopes", "repo,delete_repo"], {
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GH_FORCE_TTY: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  session.processId = child.pid;

  child.stdout.on("data", (chunk) => {
    updateSessionFromOutput(session, String(chunk));
  });

  child.stderr.on("data", (chunk) => {
    updateSessionFromOutput(session, String(chunk));
  });

  child.on("error", (error) => {
    completeSession(session, {
      status: "failed",
      message: error.message,
      instructions: "GitHub CLI 授权启动失败，请检查 gh 是否可用。",
    });
  });

  child.on("close", async (code) => {
    const latestStatus = await checkGithubAuthStatus();
    if (latestStatus.authorized) {
      completeSession(session, {
        status: "authorized",
        message: "GitHub 授权完成。",
        instructions: "GitHub 授权完成，请刷新状态或继续创建仓库。",
      });
      return;
    }

    completeSession(session, {
      status: code === 0 ? "waiting" : "failed",
      message: latestStatus.message || (code === 0 ? "等待完成 GitHub 授权。" : `gh auth login exited with code ${code ?? -1}`),
      instructions:
        session.verificationUrl || session.userCode
          ? buildInstructions(session)
          : "未能从 gh 输出中提取授权地址，请在 Claude Code 终端运行 ! gh auth login -h github.com。",
    });
  });

  return toPublicSession(session);
}
