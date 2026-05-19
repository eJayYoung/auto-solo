import { NextRequest, NextResponse } from "next/server";
import { submitTaskRecord } from "@/lib/services/feishu-base";
import { updateStoredTaskRecord } from "@/lib/services/local-task-record-store";
import type { TaskRecordSubmitInput } from "@/lib/types";

export async function PUT(request: NextRequest) {
  const input = (await request.json()) as TaskRecordSubmitInput;

  if (!input.recordId) {
    return NextResponse.json({ ok: false, error: "recordId is required" }, { status: 400 });
  }

  try {
    const result = await submitTaskRecord(input);
    await updateStoredTaskRecord(input);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submit failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
