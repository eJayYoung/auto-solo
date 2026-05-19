import { NextRequest, NextResponse } from "next/server";
import { LOGIN_REDIRECT_PATH, SESSION_COOKIE_NAME } from "@/lib/constants";

const protectedPaths = ["/", "/tasks", "/task-bank", "/github-repos"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) {
    return NextResponse.next();
  }

  if (request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_REDIRECT_PATH, request.url);
  loginUrl.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/tasks/:path*", "/task-bank/:path*", "/github-repos/:path*"],
};
