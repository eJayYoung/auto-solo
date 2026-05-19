import { NextRequest, NextResponse } from "next/server";
import { LOGIN_REDIRECT_PATH, SESSION_COOKIE_NAME } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL(LOGIN_REDIRECT_PATH, url.origin));
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
