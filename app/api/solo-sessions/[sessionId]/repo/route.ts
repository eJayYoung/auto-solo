import { NextRequest, NextResponse } from "next/server";
import { cloneSoloSessionRepository, openSoloSessionRepositoryWithTrae } from "@/lib/services/solo-workflow";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { sessionId } = await context.params;
  try {
    const input = (await request.json()) as { action?: string };
    if (input.action === "clone") {
      const session = await cloneSoloSessionRepository(sessionId);
      return NextResponse.json({ ok: true, data: session });
    }
    if (input.action === "open_trae") {
      const session = await openSoloSessionRepositoryWithTrae(sessionId);
      return NextResponse.json({ ok: true, data: session });
    }
    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "仓库操作失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
