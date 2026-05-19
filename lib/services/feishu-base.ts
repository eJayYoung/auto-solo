import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_MODEL, parseFeishuBaseUrl } from "@/lib/constants";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import type { SyncStatus, TaskItem, TaskRecord, TaskRecordSubmitInput } from "@/lib/types";

const execFileAsync = promisify(execFile);
const imageExtensionMap: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const roundMap: Record<string, number> = {
  第一轮: 1,
  第二轮: 2,
  第三轮: 3,
  第四轮: 4,
  第五轮: 5,
};
const screenshotFieldNames = ["截图（userprompt附件/产物/运行结果/对话）", "截图（userprompt附件/产物/运...", "截图"];

async function runLarkCliJson<T>(args: string[], options?: { cwd?: string }) {
  const { stdout } = await execFileAsync("lark-cli", args, {
    cwd: options?.cwd,
    env: { ...process.env, LARK_CLI_NO_PROXY: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
  return parseLarkCliPayload<T>(stdout);
}

type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
  last_modified_time?: number;
  tableId?: string;
};

type FeishuAttachment = {
  name?: string;
  file_token?: string;
  url?: string;
  tmp_url?: string;
};

type LarkCliJsonResponse<T> = {
  ok?: boolean;
  code?: number;
  msg?: string;
  data?: T;
  error?: { message?: string };
};

type LarkCliRecordListResponse = {
  ok: boolean;
  error?: {
    message?: string;
    hint?: string;
  };
  data?: {
    data?: unknown[][];
    fields?: string[];
    record_id_list?: string[];
    has_more?: boolean;
  };
};

type TmpDownloadUrlResponse = {
  tmp_download_urls?: Array<{
    file_token?: string;
    tmp_download_url?: string;
  }>;
};

function parseLarkCliPayload<T>(stdout: string) {
  const jsonStart = stdout.indexOf("{");
  const payload = JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout) as LarkCliJsonResponse<T>;
  if (payload.ok === false || (typeof payload.code === "number" && payload.code !== 0)) {
    throw new Error(payload.error?.message || payload.msg || "Lark CLI request failed");
  }
  return payload;
}

function cellToText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(cellToText).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return cellToText(objectValue.text ?? objectValue.name ?? objectValue.link ?? objectValue.url ?? objectValue.tmp_url ?? objectValue.value ?? "");
  }
  return "";
}

function getAttachmentUrl(attachment: FeishuAttachment) {
  return attachment.url ?? attachment.tmp_url;
}

function isImageAttachment(attachment: FeishuAttachment) {
  const name = attachment.name ?? "";
  const url = getAttachmentUrl(attachment) ?? "";
  return /\.(apng|avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(name) || /\.(apng|avif|gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function cellToAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<TaskRecord["screenshotAttachments"]>((acc, item) => {
    if (!item || typeof item !== "object") {
      return acc;
    }

    const attachment = item as FeishuAttachment;
    const name = attachment.name ?? attachment.file_token ?? getAttachmentUrl(attachment);
    if (!name) {
      return acc;
    }

    acc.push({
      name,
      url: getAttachmentUrl(attachment),
      fileToken: attachment.file_token,
    });
    return acc;
  }, []);
}

function cellToScreenshotValue(value: unknown) {
  if (!Array.isArray(value)) {
    return cellToText(value);
  }

  const attachment = value.find((item): item is FeishuAttachment => Boolean(item && typeof item === "object" && isImageAttachment(item as FeishuAttachment)));
  return attachment ? getAttachmentUrl(attachment) ?? attachment.name ?? "" : cellToText(value);
}

function getScreenshotFileToken(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  const attachment = value.find((item): item is FeishuAttachment => Boolean(item && typeof item === "object" && isImageAttachment(item as FeishuAttachment)));
  return attachment?.file_token ?? "";
}

function collectScreenshotFileTokens(records: TaskRecord[]) {
  return Array.from(
    new Set(
      records
        .flatMap((record) => record.screenshotAttachments)
        .map((attachment) => attachment.fileToken)
        .filter((fileToken): fileToken is string => Boolean(fileToken)),
    ),
  );
}

async function fetchTmpDownloadUrls(fileTokens: string[]) {
  const entries: Array<[string, string]> = [];

  for (let index = 0; index < fileTokens.length; index += 5) {
    const chunk = fileTokens.slice(index, index + 5);
    const payload = await runLarkCliJson<TmpDownloadUrlResponse>([
      "api",
      "GET",
      "/open-apis/drive/v1/medias/batch_get_tmp_download_url",
      "--params",
      JSON.stringify({ file_tokens: chunk.length === 1 ? chunk[0] : chunk }),
      "--as",
      "user",
    ]);

    for (const item of payload.data?.tmp_download_urls ?? []) {
      if (item.file_token && item.tmp_download_url) {
        entries.push([item.file_token, item.tmp_download_url]);
      }
    }
  }

  return new Map(entries);
}

async function hydrateScreenshotUrls(records: TaskRecord[]) {
  const fileTokens = collectScreenshotFileTokens(records);
  if (fileTokens.length === 0) {
    return records;
  }

  const tmpDownloadUrls = await fetchTmpDownloadUrls(fileTokens);
  return records.map((record) => {
    const screenshotAttachments = record.screenshotAttachments.map((attachment) => ({
      ...attachment,
      url: attachment.url ?? (attachment.fileToken ? tmpDownloadUrls.get(attachment.fileToken) : undefined),
    }));
    const firstImage = screenshotAttachments.find((attachment) => attachment.url);

    return {
      ...record,
      screenshots: firstImage?.url ?? record.screenshots,
      screenshotAttachments,
      screenshotFileToken: firstImage?.fileToken ?? record.screenshotFileToken,
      screenshotExtra: record.screenshotExtra,
    };
  });
}

function parseCliRecordListResponse(stdout: string): LarkCliRecordListResponse {
  return parseLarkCliPayload<NonNullable<LarkCliRecordListResponse["data"]>>(stdout) as LarkCliRecordListResponse;
}

function buildCliError(response: LarkCliRecordListResponse) {
  return response.error?.hint || response.error?.message || "lark-cli record list failed";
}

function mapCliRowToFeishuRecord(fields: string[], row: unknown[], recordId: string, tableId?: string): FeishuRecord {
  return {
    record_id: recordId,
    tableId,
    fields: fields.reduce<Record<string, unknown>>((acc, field, index) => {
      acc[field] = row[index];
      return acc;
    }, {}),
  };
}

function cellToRound(value: unknown): number {
  const text = cellToText(value);
  return roundMap[text] ?? (Number.parseInt(text, 10) || 1);
}

function statusToSyncStatus(value: unknown): SyncStatus {
  const text = cellToText(value);
  if (["已通过", "ai质检通过"].includes(text)) {
    return "synced";
  }
  if (["不通过", "待返修"].includes(text)) {
    return "failed";
  }
  return "draft";
}

function formatModifiedTime(value?: number) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function getScreenshotField(fields: Record<string, unknown>) {
  for (const fieldName of screenshotFieldNames) {
    if (fields[fieldName] !== undefined) {
      return fields[fieldName];
    }
  }
  return undefined;
}

function mapFeishuRecordToTaskRecord(record: FeishuRecord): TaskRecord {
  const fields = record.fields;
  const screenshotField = getScreenshotField(fields);
  return {
    uid: cellToText(fields["UID"]),
    recordId: record.record_id,
    traeSessionId: cellToText(fields["Trae Session ID"]),
    round: cellToRound(fields["轮次"]),
    userPrompt: cellToText(fields["User Prompt"]),
    taskType: cellToText(fields["任务类型"]),
    businessDomain: cellToText(fields["业务领域"]),
    modifyScope: cellToText(fields["修改范围"]),
    taskCompleted: cellToText(fields["任务是否完成"]),
    processSatisfaction: cellToText(fields["产物及过程是否满意"]),
    unsatisfiedReason: cellToText(fields["不满意原因"]),
    githubUrl: cellToText(fields["github地址"]),
    branchOrFolder: cellToText(fields["分支/文件夹"]),
    screenshots: cellToScreenshotValue(screenshotField),
    screenshotAttachments: cellToAttachments(screenshotField),
    screenshotFileToken: getScreenshotFileToken(screenshotField),
    screenshotExtra: record.tableId ? JSON.stringify({ bitablePerm: { tableId: record.tableId, rev: 1 } }) : "",
    logs: cellToText(fields["日志轨迹"]),
    qcStatus: cellToText(fields["状态"]),
    syncStatus: statusToSyncStatus(fields["状态"]),
    updatedAt: formatModifiedTime(record.last_modified_time),
  };
}

function taskRecordToTaskItem(record: TaskRecord): TaskItem | null {
  if (record.round !== 1 || !record.userPrompt) {
    return null;
  }

  return {
    taskId: `TASK-${record.recordId}`,
    uidBinding: record.uid,
    title: record.userPrompt.slice(0, 28),
    promptContent: record.userPrompt,
    promptMode: "append",
    model: DEFAULT_MODEL,
    taskType: record.taskType,
    businessDomain: record.businessDomain,
    modifyScope: record.modifyScope,
    sourceType: "synced",
    status: record.traeSessionId ? "submitted" : "ready",
    submittedAt: record.traeSessionId ? record.updatedAt : undefined,
    createdAt: record.updatedAt,
  };
}

export function buildTaskBank(records: TaskRecord[]) {
  const seen = new Set<string>();
  const items: TaskItem[] = [];

  for (const record of records) {
    const item = taskRecordToTaskItem(record);
    if (!item || seen.has(item.promptContent)) {
      continue;
    }
    seen.add(item.promptContent);
    items.push(item);
  }

  return items;
}

async function fetchTaskRecords() {
  const settings = await readUserSettings();
  const { baseToken, tableId, viewId } = parseFeishuBaseUrl(settings.feishuBaseUrl);
  const args = [
    "base",
    "+record-list",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--limit",
    "200",
    "--format",
    "json",
    "--as",
    "user",
  ];

  if (viewId) {
    args.push("--view-id", viewId);
  }

  const { stdout } = await execFileAsync("lark-cli", args, { maxBuffer: 20 * 1024 * 1024 });
  const response = parseCliRecordListResponse(stdout);
  if (!response.ok) {
    throw new Error(buildCliError(response));
  }

  const fields = response.data?.fields ?? [];
  const rows = response.data?.data ?? [];
  const recordIds = response.data?.record_id_list ?? [];
  const records = rows.map((row, index) => mapFeishuRecordToTaskRecord(mapCliRowToFeishuRecord(fields, row, recordIds[index] ?? `row-${index}`, tableId)));
  return hydrateScreenshotUrls(records);
}

export class FeishuPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeishuPermissionError";
  }
}

function isFeishuPermissionError(error: unknown) {
  return error instanceof Error && error.message.includes("Access denied");
}

export async function syncTaskRecords(): Promise<TaskRecord[]> {
  try {
    return await fetchTaskRecords();
  } catch (error) {
    if (isFeishuPermissionError(error)) {
      throw new FeishuPermissionError((error as Error).message);
    }
    throw error;
  }
}

export async function getEmptySessionRecords(): Promise<TaskRecord[]> {
  const records = await fetchTaskRecords();
  return records.filter((record) => !record.traeSessionId);
}

const submitFieldMap: Partial<Record<keyof TaskRecordSubmitInput, string>> = {
  traeSessionId: "Trae Session ID",
  round: "轮次",
  userPrompt: "User Prompt",
  taskType: "任务类型",
  businessDomain: "业务领域",
  modifyScope: "修改范围",
  githubUrl: "github地址",
  branchOrFolder: "分支/文件夹",
  logs: "日志轨迹",
  taskCompleted: "任务是否完成",
  processSatisfaction: "产物及过程是否满意",
  unsatisfiedReason: "不满意原因",
};

function buildSubmitFields(input: TaskRecordSubmitInput) {
  const fields: Record<string, string | number> = {};

  for (const [key, fieldName] of Object.entries(submitFieldMap) as Array<[keyof TaskRecordSubmitInput, string]>) {
    const value = input[key];
    if (typeof value === "string" || typeof value === "number") {
      fields[fieldName] = value;
    }
  }

  return fields;
}

async function updateTaskRecord(input: TaskRecordSubmitInput) {
  const settings = await readUserSettings();
  const { baseToken, tableId } = parseFeishuBaseUrl(settings.feishuBaseUrl);
  const fields = buildSubmitFields(input);

  if (Object.keys(fields).length === 0) {
    return;
  }

  await runLarkCliJson([
    "base",
    "+record-upsert",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--record-id",
    input.recordId,
    "--json",
    JSON.stringify(fields),
    "--as",
    "user",
  ]);
}

async function uploadScreenshotAttachment(input: TaskRecordSubmitInput) {
  if (!input.screenshot?.contentBase64) {
    return;
  }

  const settings = await readUserSettings();
  const { baseToken, tableId } = parseFeishuBaseUrl(settings.feishuBaseUrl);
  const directory = await mkdtemp(path.join(tmpdir(), "auto-solo-screenshot-"));
  const extension = imageExtensionMap[input.screenshot.type] ?? ".png";
  const fileName = path.basename(input.screenshot.name || `${input.recordId}${extension}`);
  const filePath = path.join(directory, fileName);

  try {
    const fileBuffer = Buffer.from(input.screenshot.contentBase64, "base64");
    await writeFile(filePath, fileBuffer);
    const uploadPayload = await runLarkCliJson<{ file_token?: string }>([
      "api",
      "POST",
      "/open-apis/drive/v1/medias/upload_all",
      "--file",
      `file=./${fileName}`,
      "--data",
      JSON.stringify({
        file_name: fileName,
        parent_type: "bitable_file",
        parent_node: baseToken,
        size: fileBuffer.byteLength,
      }),
      "--as",
      "user",
    ], { cwd: directory });
    const fileToken = uploadPayload.data?.file_token;
    if (!fileToken) {
      throw new Error("Lark media upload did not return file_token");
    }

    await runLarkCliJson([
      "api",
      "PUT",
      `/open-apis/bitable/v1/apps/${baseToken}/tables/${tableId}/records/${input.recordId}`,
      "--data",
      JSON.stringify({
        fields: {
          "截图（userprompt附件/产物/运行结果/对话）": [{ file_token: fileToken }],
        },
      }),
      "--as",
      "user",
    ]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function downloadFeishuMedia(fileToken: string, extra?: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "auto-solo-feishu-media-"));
  const filePath = path.join(directory, fileToken);
  const args = ["api", "GET", `/open-apis/drive/v1/medias/${fileToken}/download`, "--as", "user", "--output", fileToken];
  if (extra) {
    args.push("--params", JSON.stringify({ extra }));
  }

  try {
    await execFileAsync("lark-cli", args, {
      cwd: directory,
      env: { ...process.env, LARK_CLI_NO_PROXY: "1" },
      maxBuffer: 20 * 1024 * 1024,
    });
    const body = await readFile(filePath);
    return { body, contentType: "image/png" };
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function submitTaskRecord(input: TaskRecordSubmitInput): Promise<{ ok: boolean; recordId: string }> {
  await updateTaskRecord(input);
  await uploadScreenshotAttachment(input);
  return { ok: true, recordId: input.recordId };
}
