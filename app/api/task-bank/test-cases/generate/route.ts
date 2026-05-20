import { NextRequest, NextResponse } from "next/server";
import { readStoredTaskBankItems, updateStoredTaskBankItemTestCases } from "@/lib/services/local-task-bank-store";
import { generateTaskTestCases } from "@/lib/services/task-testcase-generation";
import type { TaskItem } from "@/lib/types";

type GenerateTestCasesRequest = {
  taskIds?: unknown;
  model?: string;
  overwrite?: boolean;
};

type GenerateTestCasesResult = {
  taskId: string;
  status: "generated" | "skipped" | "failed";
  error?: string;
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

    let items = await readStoredTaskBankItems();
    const itemById = new Map(items.map((item) => [item.taskId, item]));
    const results: GenerateTestCasesResult[] = [];

    for (const taskId of taskIds) {
      const item = itemById.get(taskId);
      if (!item) {
        results.push({ taskId, status: "failed", error: "题目不存在" });
        continue;
      }

      if (item.testCasesJson && !payload.overwrite) {
        results.push({ taskId, status: "skipped" });
        continue;
      }

      try {
        const testCaseSet = await generateTaskTestCases(item, { model: payload.model });
        const model = payload.model || item.model;
        items = await updateStoredTaskBankItemTestCases(taskId, JSON.stringify(testCaseSet, null, 2), model);
        const updatedItem = items.find((task) => task.taskId === taskId) as TaskItem | undefined;
        if (updatedItem) {
          itemById.set(taskId, updatedItem);
        }
        results.push({ taskId, status: "generated" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generate test cases failed";
        results.push({ taskId, status: "failed", error: message });
      }
    }

    return NextResponse.json({ ok: true, data: { items, results } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate test cases failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
