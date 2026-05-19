import { NextResponse } from "next/server";
import { logoutGithubAuth } from "@/lib/services/github-auth";

export async function POST() {
  try {
    const status = await logoutGithubAuth();
    return NextResponse.json({ ok: true, data: status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub logout failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
