import { NextResponse } from "next/server";
import { startGithubLoginSession } from "@/lib/services/github-auth";

export async function POST() {
  try {
    const session = await startGithubLoginSession();
    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub login failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
