import { NextRequest, NextResponse } from "next/server";
import { createSoloSessionFromWorkspace, readSoloSessions } from "@/lib/services/solo-workflow";

export async function GET() {
  try {
    const sessions = await readSoloSessions();
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取 Solo 会话失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { workspaceId?: string };
    if (!input.workspaceId?.trim()) {
      return NextResponse.json({ ok: false, error: "workspaceId is required" }, { status: 400 });
    }
    const session = await createSoloSessionFromWorkspace(input.workspaceId);
    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建 Solo 会话失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
