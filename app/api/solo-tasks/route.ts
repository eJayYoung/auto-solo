import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { checkGithubAuthStatus } from "@/lib/services/github-auth";
import { createSoloTasks, readSoloSessions } from "@/lib/services/solo-workflow";

const execFileAsync = promisify(execFile);

function parseRepoNames(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("repoNames must be a non-empty string array");
  }
  const repoNames = value.map((item) => item.trim()).filter(Boolean);
  if (repoNames.length === 0) {
    throw new Error("repoNames must be a non-empty string array");
  }
  return repoNames;
}

async function createPublicGithubRepos(githubOwner: string, repoNames: string[]) {
  const results = await Promise.allSettled(repoNames.map((repoName) => execFileAsync("gh", ["repo", "create", `${githubOwner}/${repoName}`, "--public", "--clone=false"], { maxBuffer: 10 * 1024 * 1024 })));
  const failed = results
    .map((result, index) => result.status === "rejected" ? `${repoNames[index]}: ${result.reason instanceof Error ? result.reason.message : "创建失败"}` : "")
    .filter(Boolean);
  if (failed.length > 0) {
    throw new Error(failed.join("\n"));
  }
}

export async function GET() {
  try {
    const sessions = await readSoloSessions();
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取 Solo 任务失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { repoNames?: unknown };
    const authStatus = await checkGithubAuthStatus();
    if (!authStatus.authorized || !authStatus.accountName) {
      return NextResponse.json({ ok: false, error: "请先完成 GitHub 授权，再创建任务。", code: "github_auth_required" }, { status: 401 });
    }

    const repoNames = parseRepoNames(input.repoNames);
    const sessions = await createSoloTasks(repoNames, authStatus.accountName);
    await createPublicGithubRepos(authStatus.accountName, repoNames);
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "新增任务失败";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
