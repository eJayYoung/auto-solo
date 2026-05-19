import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseFeishuBaseUrl } from "@/lib/constants";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import type { SyncStatus, TaskRecord } from "@/lib/types";

const execFileAsync = promisify(execFile);

const roundMap: Record<string, number> = {
  第一轮: 1,
  第二轮: 2,
  第三轮: 3,
  第四轮: 4,
  第五轮: 5,
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
    return cellToText(objectValue.text ?? objectValue.name ?? objectValue.link ?? objectValue.url ?? objectValue.value ?? "");
  }
  return "";
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

function mapRowToTaskRecord(fields: string[], row: unknown[], recordId: string): TaskRecord {
  const values = fields.reduce<Record<string, unknown>>((acc, field, index) => {
    acc[field] = row[index];
    return acc;
  }, {});

  return {
    uid: cellToText(values["UID"]),
    recordId,
    traeSessionId: cellToText(values["Trae Session ID"]),
    round: cellToRound(values["轮次"]),
    userPrompt: cellToText(values["User Prompt"]),
    taskType: cellToText(values["任务类型"]),
    businessDomain: cellToText(values["业务领域"]),
    modifyScope: cellToText(values["修改范围"]),
    taskCompleted: cellToText(values["任务是否完成"]),
    processSatisfaction: cellToText(values["产物及过程是否满意"]),
    unsatisfiedReason: cellToText(values["不满意原因"]),
    githubUrl: cellToText(values["github地址"]),
    branchOrFolder: cellToText(values["分支/文件夹"]),
    screenshots: cellToText(values["截图（userprompt附件/产物/运..."] ?? values["截图"]),
    screenshotAttachments: [],
    screenshotFileToken: "",
    screenshotExtra: "",
    logs: cellToText(values["日志轨迹"]),
    qcStatus: cellToText(values["状态"]),
    syncStatus: statusToSyncStatus(values["状态"]),
    updatedAt: cellToText(values["质检时间"] ?? values["标注时间"]),
  };
}

function parseCliResponse(stdout: string): LarkCliRecordListResponse {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) {
    throw new Error(stdout || "lark-cli returned empty output");
  }
  return JSON.parse(stdout.slice(jsonStart)) as LarkCliRecordListResponse;
}

function buildCliError(response: LarkCliRecordListResponse) {
  return response.error?.hint || response.error?.message || "lark-cli record list failed";
}

export async function syncTaskRecordsWithLarkCli(): Promise<TaskRecord[]> {
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

  const response = parseCliResponse(stdout);
  if (!response.ok) {
    throw new Error(buildCliError(response));
  }

  const fields = response.data?.fields ?? [];
  const rows = response.data?.data ?? [];
  const recordIds = response.data?.record_id_list ?? [];
  return rows.map((row, index) => mapRowToTaskRecord(fields, row, recordIds[index] ?? `row-${index}`));
}
