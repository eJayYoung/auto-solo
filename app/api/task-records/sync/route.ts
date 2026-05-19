import { NextResponse } from "next/server";
import { syncTaskRecords } from "@/lib/services/feishu-base";
import { writeStoredTaskRecords } from "@/lib/services/local-task-record-store";

export async function POST() {
  try {
    const records = await writeStoredTaskRecords(await syncTaskRecords());
    return NextResponse.json({ ok: true, records, count: records.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
