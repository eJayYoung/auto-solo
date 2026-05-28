import { NextRequest, NextResponse } from "next/server";
import { importSoloRound, importSoloSessionRounds } from "@/lib/services/solo-workflow";

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { roundId?: string; sessionId?: string };
    if (input.roundId?.trim()) {
      const round = await importSoloRound(input.roundId);
      return NextResponse.json({ ok: true, data: [round] });
    }
    if (input.sessionId?.trim()) {
      const rounds = await importSoloSessionRounds(input.sessionId);
      return NextResponse.json({ ok: true, data: rounds });
    }
    return NextResponse.json({ ok: false, error: "roundId or sessionId is required" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入飞书失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
