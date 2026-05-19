import { NextResponse } from "next/server";
import { GithubAuthRequiredError, deleteGithubRepo, listGithubRepos, openGithubRepoWithTrae } from "@/lib/services/github-repos";

export async function GET() {
  try {
    const data = await listGithubRepos();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof GithubAuthRequiredError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "读取 GitHub 仓库失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { repoFullName?: unknown; action?: unknown };
    if (payload.action !== "open-trae") {
      return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
    }
    if (typeof payload.repoFullName !== "string" || !payload.repoFullName.trim()) {
      return NextResponse.json({ ok: false, error: "repoFullName is required" }, { status: 400 });
    }

    await openGithubRepoWithTrae(payload.repoFullName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GithubAuthRequiredError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "打开 Trae 失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { repoFullName?: unknown };
    if (typeof payload.repoFullName !== "string" || !payload.repoFullName.trim()) {
      return NextResponse.json({ ok: false, error: "repoFullName is required" }, { status: 400 });
    }

    await deleteGithubRepo(payload.repoFullName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GithubAuthRequiredError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    const message = error instanceof Error ? error.message : "删除 GitHub 仓库失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
