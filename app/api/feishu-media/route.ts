import { NextRequest, NextResponse } from "next/server";
import { downloadFeishuMedia } from "@/lib/services/feishu-base";

export async function GET(request: NextRequest) {
  const fileToken = request.nextUrl.searchParams.get("fileToken")?.trim();
  const extra = request.nextUrl.searchParams.get("extra") ?? undefined;
  if (!fileToken) {
    return NextResponse.json({ ok: false, error: "fileToken is required" }, { status: 400 });
  }

  try {
    const media = await downloadFeishuMedia(fileToken, extra);
    return new NextResponse(media.body, {
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
