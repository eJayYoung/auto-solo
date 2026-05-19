import { NextResponse } from "next/server";
import { getGithubLoginSession } from "@/lib/services/github-auth";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const session = getGithubLoginSession(sessionId);

  if (!session) {
    return NextResponse.json({ ok: false, error: "GitHub login session not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: session });
}
