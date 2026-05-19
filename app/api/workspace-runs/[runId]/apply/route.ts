import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { updateStoredTaskRecord } from "@/lib/services/local-task-record-store";
import { readWorkspaceRun } from "@/lib/services/workspace-runtime";
import type { TaskRecordScreenshotInput } from "@/lib/types";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

function mimeTypeFromPath(value: string) {
  if (/\.jpe?g$/i.test(value)) {
    return "image/jpeg";
  }
  if (/\.webp$/i.test(value)) {
    return "image/webp";
  }
  if (/\.gif$/i.test(value)) {
    return "image/gif";
  }
  return "image/png";
}

async function readScreenshotInput(path: string, mimeType: string): Promise<TaskRecordScreenshotInput | undefined> {
  if (!path) {
    return undefined;
  }

  const content = await readFile(path);
  return {
    contentBase64: content.toString("base64"),
    name: path.split(/[\\/]/).pop() || "workspace-run.png",
    type: mimeType || mimeTypeFromPath(path),
  };
}

export async function POST(_request: Request, context: RouteContext) {
  const { runId } = await context.params;

  try {
    const run = await readWorkspaceRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: "Workspace run not found" }, { status: 404 });
    }

    const screenshot = await readScreenshotInput(run.screenshotPath, run.screenshotMimeType);
    await updateStoredTaskRecord({
      recordId: run.recordId,
      githubUrl: run.githubUrl,
      branchOrFolder: run.branchName,
      logs: run.logsText,
      processSatisfaction: run.aiSuggestedSatisfaction,
      unsatisfiedReason: run.aiSuggestedReason,
      screenshot,
    });

    return NextResponse.json({ ok: true, data: run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apply workspace run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
