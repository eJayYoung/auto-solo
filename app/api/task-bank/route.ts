import { NextRequest, NextResponse } from "next/server";
import { appendStoredTaskBankItems, readStoredTaskBankItems, removeStoredTaskBankItem } from "@/lib/services/local-task-bank-store";
import type { TaskItem } from "@/lib/types";

type InsertPayload = {
  items?: TaskItem[];
};

type DeletePayload = {
  taskId?: string;
};

export async function GET() {
  const items = await readStoredTaskBankItems();
  return NextResponse.json({ ok: true, data: items });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as InsertPayload;
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json({ ok: false, error: "items is required" }, { status: 400 });
    }

    const items = await appendStoredTaskBankItems(payload.items);
    return NextResponse.json({ ok: true, data: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Insert task bank items failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = (await request.json()) as DeletePayload;
    if (!payload.taskId) {
      return NextResponse.json({ ok: false, error: "taskId is required" }, { status: 400 });
    }

    const items = await removeStoredTaskBankItem(payload.taskId);
    return NextResponse.json({ ok: true, data: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete task bank item failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
