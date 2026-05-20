import { NextRequest, NextResponse } from "next/server";
import { generateTaskTestCasesForTaskIds } from "@/lib/services/task-testcase-generation";

type GenerateTestCasesRequest = {
  taskIds?: unknown;
  model?: string;
  overwrite?: boolean;
};

function normalizeTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))];
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as GenerateTestCasesRequest;
    const taskIds = normalizeTaskIds(payload.taskIds);
    if (taskIds.length === 0) {
      return NextResponse.json({ ok: false, error: "taskIds is required" }, { status: 400 });
    }

    const data = await generateTaskTestCasesForTaskIds(taskIds, { model: payload.model, overwrite: payload.overwrite });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate test cases failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
