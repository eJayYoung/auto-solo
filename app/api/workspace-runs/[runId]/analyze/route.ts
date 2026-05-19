import { NextResponse } from "next/server";
import { analyzeWorkspaceRun } from "@/lib/services/task-evaluation";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { runId } = await context.params;

  try {
    const run = await analyzeWorkspaceRun(runId);
    return NextResponse.json({ ok: true, data: run });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze workspace run failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
