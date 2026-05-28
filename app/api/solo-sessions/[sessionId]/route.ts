import { NextResponse } from "next/server";
import { readSoloSession } from "@/lib/services/solo-workflow";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  try {
    const session = await readSoloSession(sessionId);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Solo session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取 Solo 会话失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
