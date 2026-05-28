import { NextRequest, NextResponse } from "next/server";
import { createInitialRound, deleteSoloRound, updateSoloRound } from "@/lib/services/solo-workflow";
import type { SoloPromptResult, SoloRound } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { sessionId?: string; prompt?: SoloPromptResult };
    if (!input.sessionId?.trim()) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }
    const round = await createInitialRound(input.sessionId, input.prompt);
    return NextResponse.json({ ok: true, data: round });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建轮次失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = (await request.json()) as Partial<SoloRound> & { roundId?: string };
    if (!input.roundId?.trim()) {
      return NextResponse.json({ ok: false, error: "roundId is required" }, { status: 400 });
    }
    const round = await updateSoloRound(input.roundId, input);
    return NextResponse.json({ ok: true, data: round });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新轮次失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const input = (await request.json()) as { sessionId?: string; roundId?: string };
    if (!input.sessionId?.trim()) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }
    if (!input.roundId?.trim()) {
      return NextResponse.json({ ok: false, error: "roundId is required" }, { status: 400 });
    }
    const session = await deleteSoloRound(input.sessionId, input.roundId);
    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除轮次失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
