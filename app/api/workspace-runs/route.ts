import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceRun } from "@/lib/services/workspace-runtime";
import type { WorkspaceRunSubmitInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as WorkspaceRunSubmitInput;
    if (!input.workspaceId?.trim()) {
      return NextResponse.json({ ok: false, error: "workspaceId is required" }, { status: 400 });
    }

    const run = await createWorkspaceRun(input);
    return NextResponse.json({ ok: true, data: run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create workspace run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
