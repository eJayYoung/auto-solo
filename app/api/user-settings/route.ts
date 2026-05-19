import { NextRequest, NextResponse } from "next/server";
import { readUserSettings, writeUserSettings } from "@/lib/services/local-user-settings-store";
import type { UserSettingsInput } from "@/lib/types";

function isVisibility(value: unknown): value is "public" | "private" {
  return value === "public" || value === "private";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateUserSettings(input: Partial<UserSettingsInput>) {
  if (!isString(input.feishuAppId)) {
    throw new Error("feishuAppId is required");
  }
  if (!isString(input.feishuAppSecret)) {
    throw new Error("feishuAppSecret is required");
  }
  if (!isString(input.feishuRedirectUri) || !input.feishuRedirectUri.trim()) {
    throw new Error("feishuRedirectUri is required");
  }
  if (!isString(input.feishuBaseUrl) || !input.feishuBaseUrl.trim()) {
    throw new Error("feishuBaseUrl is required");
  }
  if (!isString(input.sessionSecret) || !input.sessionSecret.trim()) {
    throw new Error("sessionSecret is required");
  }
  if (!isString(input.githubOwner) || !input.githubOwner.trim()) {
    throw new Error("githubOwner is required");
  }
  if (!isVisibility(input.repoVisibility)) {
    throw new Error("repoVisibility must be public or private");
  }
  if (!isBoolean(input.cloneEnabled)) {
    throw new Error("cloneEnabled must be boolean");
  }
  if (!isBoolean(input.openTraeEnabled)) {
    throw new Error("openTraeEnabled must be boolean");
  }
  if (!isString(input.localRoot) || !input.localRoot.trim()) {
    throw new Error("localRoot is required");
  }
  if (!isString(input.traeAppName) || !input.traeAppName.trim()) {
    throw new Error("traeAppName is required");
  }
  if (!isString(input.modelProvider) || input.modelProvider !== "openai_compatible") {
    throw new Error("modelProvider must be openai_compatible");
  }
  if (!isString(input.modelBaseUrl) || !input.modelBaseUrl.trim()) {
    throw new Error("modelBaseUrl is required");
  }
  if (!isString(input.modelApiPath) || !input.modelApiPath.trim()) {
    throw new Error("modelApiPath is required");
  }
  if (!isString(input.model) || !input.model.trim()) {
    throw new Error("model is required");
  }
  if (!isString(input.modelKey)) {
    throw new Error("modelKey must be string");
  }
  if (!isStringArray(input.dashboardMetricCardOrder)) {
    throw new Error("dashboardMetricCardOrder must be string[]");
  }
  if (!isStringArray(input.dashboardActionCardOrder)) {
    throw new Error("dashboardActionCardOrder must be string[]");
  }
}

export async function GET() {
  const settings = await readUserSettings();
  return NextResponse.json({ ok: true, data: settings });
}

export async function PUT(request: NextRequest) {
  try {
    const input = (await request.json()) as Partial<UserSettingsInput>;
    validateUserSettings(input);
    const settings = await writeUserSettings(input as UserSettingsInput);
    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save settings failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
