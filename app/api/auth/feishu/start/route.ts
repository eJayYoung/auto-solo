import { NextRequest, NextResponse } from "next/server";
import { FEISHU_OAUTH_AUTHORIZE_URL, FEISHU_SCOPE } from "@/lib/constants";
import { readUserSettings } from "@/lib/services/local-user-settings-store";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") || "/";
  const settings = await readUserSettings();
  if (!settings.feishuAppId || !settings.feishuRedirectUri) {
    return NextResponse.redirect(new URL("/settings", url.origin));
  }

  const state = Buffer.from(JSON.stringify({ redirectTo })).toString("base64url");
  const authorizeUrl = new URL(FEISHU_OAUTH_AUTHORIZE_URL);

  authorizeUrl.searchParams.set("app_id", settings.feishuAppId);
  authorizeUrl.searchParams.set("redirect_uri", settings.feishuRedirectUri);
  authorizeUrl.searchParams.set("scope", FEISHU_SCOPE);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
