import { NextRequest, NextResponse } from "next/server";
import { generateSoloRoundPrompt } from "@/lib/services/solo-workflow";

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { roundId?: string };
    if (!input.roundId?.trim()) {
      return NextResponse.json({ ok: false, error: "roundId is required" }, { status: 400 });
    }
    const round = await generateSoloRoundPrompt(input.roundId);
    return NextResponse.json({ ok: true, data: round });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成 Prompt 失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
