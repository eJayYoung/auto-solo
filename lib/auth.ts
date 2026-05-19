type SessionUser = {
  openId: string;
  unionId?: string;
  name: string;
  avatarUrl?: string;
};

type SessionPayload = {
  user: SessionUser;
  expiresAt: number;
};

import { readUserSettings } from "@/lib/services/local-user-settings-store";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getSessionSecret() {
  const { sessionSecret } = await readUserSettings();
  if (!sessionSecret) {
    throw new Error("会话签名密钥不能为空");
  }
  return sessionSecret;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(await getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("base64url");
}

export async function createSessionCookie(user: SessionUser) {
  const payload: SessionPayload = {
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

export async function readSessionCookie(value?: string | null): Promise<SessionPayload | null> {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");
  if (!body || !signature) {
    return null;
  }

  const expected = await sign(body);
  if (expected !== signature) {
    return null;
  }

  const payload = JSON.parse(decodeBase64Url(body)) as SessionPayload;
  if (payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export function createExpiredSessionCookie() {
  return "";
}

export function getSessionCookieName() {
  return "auto_solo_session";
}

export async function getCurrentUserFromCookies(cookieHeader?: string | null) {
  const match = cookieHeader?.match(/(?:^|;\s*)auto_solo_session=([^;]+)/);
  const session = await readSessionCookie(match?.[1] ? decodeURIComponent(match[1]) : null);
  return session?.user ?? null;
}
