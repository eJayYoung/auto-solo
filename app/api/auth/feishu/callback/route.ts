import { NextRequest, NextResponse } from "next/server";
import {
  FEISHU_OAUTH_TOKEN_URL,
  FEISHU_USER_INFO_URL,
  LOGIN_REDIRECT_PATH,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/constants";
import { createSessionCookie } from "@/lib/auth";
import { readUserSettings } from "@/lib/services/local-user-settings-store";

type FeishuTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  open_id?: string;
  union_id?: string;
  name?: string;
  en_name?: string;
  avatar_url?: string;
  data?: {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    open_id?: string;
    union_id?: string;
    name?: string;
    en_name?: string;
    avatar_url?: string;
  };
};

type FeishuUserInfoResponse = {
  data?: {
    open_id?: string;
    union_id?: string;
    name?: string;
    en_name?: string;
    nickname?: string;
    avatar_url?: string;
    avatar_url_large?: string;
  };
};

async function fetchJson(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || JSON.stringify(payload));
  }
  return payload;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return NextResponse.redirect(new URL(`${LOGIN_REDIRECT_PATH}?error=missing_code`, url.origin));
  }

  let redirectTo = "/";
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { redirectTo?: string };
      if (typeof parsed.redirectTo === "string" && parsed.redirectTo.startsWith("/")) {
        redirectTo = parsed.redirectTo;
      }
    } catch {
      redirectTo = "/";
    }
  }

  const settings = await readUserSettings();
  if (!settings.feishuAppId || !settings.feishuAppSecret || !settings.feishuRedirectUri) {
    return NextResponse.redirect(new URL(`${LOGIN_REDIRECT_PATH}?error=missing_feishu_config`, url.origin));
  }

  const tokenResponse = (await fetchJson(FEISHU_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: settings.feishuAppId,
      client_secret: settings.feishuAppSecret,
      code,
      redirect_uri: settings.feishuRedirectUri,
    }),
  })) as FeishuTokenResponse;

  const tokenData = tokenResponse.data ?? tokenResponse;
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error("Feishu OAuth access_token is missing");
  }

  const userInfoResponse = (await fetchJson(FEISHU_USER_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })) as FeishuUserInfoResponse;
  const userInfo = userInfoResponse.data ?? {};
  const user = {
    openId: userInfo.open_id || tokenData.open_id || "",
    unionId: userInfo.union_id || tokenData.union_id,
    name: userInfo.name || userInfo.en_name || userInfo.nickname || tokenData.name || tokenData.en_name || "飞书用户",
    avatarUrl: userInfo.avatar_url || userInfo.avatar_url_large || tokenData.avatar_url,
  };

  const session = await createSessionCookie(user);
  const response = NextResponse.redirect(new URL(redirectTo || "/", url.origin));
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return response;
}
