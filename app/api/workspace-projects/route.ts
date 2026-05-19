import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceProject, createWorkspaceProjectsBatch, GithubAuthRequiredError } from "@/lib/services/github-workspace";
import { readWorkspaceProjects } from "@/lib/services/local-user-settings-store";
import type { CreateWorkspaceBatchInput, CreateWorkspaceInput, CreateWorkspaceTargetRecord } from "@/lib/types";

function isVisibility(value: unknown): value is "public" | "private" {
  return value === "public" || value === "private";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTargetRecord(value: unknown): value is CreateWorkspaceTargetRecord {
  return typeof value === "object" && value !== null && isString((value as CreateWorkspaceTargetRecord).recordId) && isString((value as CreateWorkspaceTargetRecord).githubUrl) && isString((value as CreateWorkspaceTargetRecord).branchOrFolder);
}

function isTargetRecordArray(value: unknown): value is CreateWorkspaceTargetRecord[] {
  return Array.isArray(value) && value.every(isTargetRecord);
}

function validateSharedInput(input: Partial<CreateWorkspaceInput | CreateWorkspaceBatchInput>) {
  if (!isString(input.taskId) || !input.taskId.trim()) {
    throw new Error("taskId is required");
  }
  if (input.githubOwner != null && (!isString(input.githubOwner) || !input.githubOwner.trim())) {
    throw new Error("githubOwner must be a non-empty string when provided");
  }
  if (!isVisibility(input.visibility)) {
    throw new Error("visibility must be public or private");
  }
  if (!isString(input.localRoot) || !input.localRoot.trim()) {
    throw new Error("localRoot is required");
  }
  if (!isBoolean(input.cloneEnabled)) {
    throw new Error("cloneEnabled must be boolean");
  }
  if (!isBoolean(input.openTraeEnabled)) {
    throw new Error("openTraeEnabled must be boolean");
  }
  if (!isString(input.traeAppName) || !input.traeAppName.trim()) {
    throw new Error("traeAppName is required");
  }
}

function validateSingleInput(input: Partial<CreateWorkspaceInput>) {
  validateSharedInput(input);
  if (!isString(input.repoName) || !input.repoName.trim()) {
    throw new Error("repoName is required");
  }
  if (input.targetRecord != null && !isTargetRecord(input.targetRecord)) {
    throw new Error("targetRecord must be a task record mapping when provided");
  }
}

function validateBatchInput(input: Partial<CreateWorkspaceBatchInput>) {
  validateSharedInput(input);
  if (!isStringArray(input.repoNames) || input.repoNames.length === 0) {
    throw new Error("repoNames must be a non-empty string array");
  }
  if (input.targetRecords != null && !isTargetRecordArray(input.targetRecords)) {
    throw new Error("targetRecords must be an array of task record mappings when provided");
  }
}

export async function GET() {
  try {
    const projects = await readWorkspaceProjects();
    return NextResponse.json({ ok: true, data: projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取工作区项目失败";
    const code = error instanceof GithubAuthRequiredError ? "github_auth_required" : undefined;
    const status = error instanceof GithubAuthRequiredError ? 401 : 500;
    return NextResponse.json({ ok: false, error: message, code }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as Partial<CreateWorkspaceInput & CreateWorkspaceBatchInput>;

    if (input.repoNames != null) {
      validateBatchInput(input);
      const result = await createWorkspaceProjectsBatch(input as CreateWorkspaceBatchInput);
      return NextResponse.json({ ok: true, data: result });
    }

    validateSingleInput(input);
    const project = await createWorkspaceProject(input as CreateWorkspaceInput);
    return NextResponse.json({
      ok: true,
      data: {
        projects: [project],
        failedItems: [],
        successCount: 1,
        failureCount: 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create workspace failed";
    const code = error instanceof GithubAuthRequiredError ? "github_auth_required" : undefined;
    return NextResponse.json({ ok: false, error: message, code }, { status: 400 });
  }
}
