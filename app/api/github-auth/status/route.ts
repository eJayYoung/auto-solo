import { NextResponse } from "next/server";
import { checkGithubAuthStatus, readCachedGithubAuthStatus } from "@/lib/services/github-auth";

export async function GET() {
  const status = await checkGithubAuthStatus();
  return NextResponse.json({ ok: true, data: status });
}

export async function POST() {
  const status = await readCachedGithubAuthStatus();
  return NextResponse.json({ ok: true, data: status });
}
