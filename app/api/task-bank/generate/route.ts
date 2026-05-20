import { NextRequest, NextResponse } from "next/server";
import { TASK_DIFFICULTY_OPTIONS } from "@/lib/constants";
import { buildTaskBank } from "@/lib/services/feishu-base";
import { readStoredTaskRecords } from "@/lib/services/local-task-record-store";
import { generateTasks } from "@/lib/services/task-generation";

type GenerateRequest = {
  count?: number;
  model?: string;
  promptMode?: "append" | "override";
  basePrompt?: string;
  userPrompt?: string;
  businessDomains?: unknown;
  difficulty?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as GenerateRequest;
    const count = typeof input.count === "number" ? input.count : 5;
    const promptMode = input.promptMode === "override" ? "override" : "append";
    const businessDomains = Array.isArray(input.businessDomains)
      ? input.businessDomains.filter((domain): domain is string => typeof domain === "string" && domain.trim().length > 0).map((domain) => domain.trim())
      : undefined;
    const difficulty = TASK_DIFFICULTY_OPTIONS.find((option) => option.value === input.difficulty)?.value;

    const taskRecords = await readStoredTaskRecords();
    const existingTasks = buildTaskBank(taskRecords);
    const generated = await generateTasks({
      count,
      model: input.model,
      promptMode,
      basePrompt: input.basePrompt,
      userPrompt: input.userPrompt,
      businessDomains,
      difficulty,
      existingTasks,
    });

    return NextResponse.json({ ok: true, data: generated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate tasks failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
