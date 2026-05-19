"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { TASK_RECORD_COLUMN_MAPPINGS } from "@/lib/task-record-columns";
import type { TaskRecord, WorkspaceRun } from "@/lib/types";

const draftFields = [
  "traeSessionId",
  "round",
  "userPrompt",
  "taskType",
  "businessDomain",
  "modifyScope",
  "taskCompleted",
  "processSatisfaction",
  "unsatisfiedReason",
  "githubUrl",
  "branchOrFolder",
  "logs",
] as const;
const roundOptions = [
  { label: "第一轮", value: 1 },
  { label: "第二轮", value: 2 },
  { label: "第三轮", value: 3 },
  { label: "第四轮", value: 4 },
  { label: "第五轮", value: 5 },
] as const;
const selectOptions = {
  taskType: ["Bug修复", "0-1代码生成", "Feature迭代", "代码理解", "代码重构", "工程化", "代码测试"],
  businessDomain: [
    "纯后端API服务",
    "Web前端",
    "全栈Web应用",
    "游戏开发",
    "数据分析与可视化（如 Dash/Streamlit）",
    "3D/交互可视化",
    "AI/ML应用",
    "科学计算",
    "命令行工具",
    "桌面应用（含GUI）",
    "自动化与工具脚本",
  ],
  modifyScope: ["无需修改", "单文件", "局部逻辑修改", "模块内多文件", "跨模块多文件", "跨系统多模块"],
  taskCompleted: ["未完成任务", "完成了任务"],
  processSatisfaction: ["满意", "不满意"],
} as const;

type DraftField = (typeof draftFields)[number];
type TaskRecordDraft = Pick<TaskRecord, DraftField>;

type TaskRecordDrafts = Record<string, Partial<TaskRecordDraft>>;
type ScreenshotDraft = {
  dataUrl: string;
  name: string;
  type: string;
};
type ScreenshotDrafts = Record<string, ScreenshotDraft>;
type SubmitStatus = "idle" | "submitting" | "success" | "error";
type SubmitState = Record<string, { status: SubmitStatus; error?: string }>;

type TaskRecordsTableProps = {
  mode: "reviewed" | "pending" | "rejected";
  records: TaskRecord[];
  workspaceRunsByRecord?: Record<string, WorkspaceRun>;
};

function getDraftStorageKey(recordId: string) {
  return `auto-solo:task-draft:${recordId}`;
}

function readDraft(recordId: string): Partial<TaskRecordDraft> {
  if (typeof window === "undefined") {
    return {};
  }

  const value = window.localStorage.getItem(getDraftStorageKey(recordId));
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Partial<TaskRecordDraft>;
  } catch {
    return {};
  }
}

function writeDraft(recordId: string, draft: Partial<TaskRecordDraft>) {
  window.localStorage.setItem(getDraftStorageKey(recordId), JSON.stringify(draft));
}

function removeDraft(recordId: string) {
  window.localStorage.removeItem(getDraftStorageKey(recordId));
}

function renderCellValue(record: TaskRecord, draft: Partial<TaskRecordDraft>, field: keyof TaskRecord, includeDraft: boolean) {
  if (includeDraft && draftFields.includes(field as DraftField)) {
    return draft[field as DraftField] ?? record[field];
  }

  return record[field];
}

function getScreenshotDraftStorageKey(recordId: string) {
  return `auto-solo:task-screenshot-draft:${recordId}`;
}

function readScreenshotDraft(recordId: string): ScreenshotDraft | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const value = window.localStorage.getItem(getScreenshotDraftStorageKey(recordId));
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as ScreenshotDraft;
  } catch {
    return undefined;
  }
}

function writeScreenshotDraft(recordId: string, draft: ScreenshotDraft) {
  window.localStorage.setItem(getScreenshotDraftStorageKey(recordId), JSON.stringify(draft));
}

function removeScreenshotDraft(recordId: string) {
  window.localStorage.removeItem(getScreenshotDraftStorageKey(recordId));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.split(",", 2)[1] ?? "";
}

function getImagePreviewSource(value?: string) {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue || (!/^https?:\/\//i.test(trimmedValue) && !trimmedValue.startsWith("/api/feishu-media") && !/^data:image\//i.test(trimmedValue))) {
    return undefined;
  }

  return trimmedValue;
}

function getFeishuMediaPreviewSource(record: TaskRecord) {
  if (!record.screenshotFileToken) {
    return undefined;
  }

  const params = new URLSearchParams({ fileToken: record.screenshotFileToken });
  if (record.screenshotExtra) {
    params.set("extra", record.screenshotExtra);
  }
  return `/api/feishu-media?${params.toString()}`;
}

function getExistingScreenshotPreview(record: TaskRecord) {
  const attachment = record.screenshotAttachments.find((item) => getImagePreviewSource(item.url));
  if (attachment) {
    return {
      label: attachment.name,
      source: getImagePreviewSource(attachment.url),
    };
  }

  const source = getFeishuMediaPreviewSource(record) ?? getImagePreviewSource(record.screenshots);
  return source ? { label: record.screenshots || record.screenshotFileToken, source } : undefined;
}

export function TaskRecordsTable({ mode, records, workspaceRunsByRecord = {} }: TaskRecordsTableProps) {
  const [drafts, setDrafts] = useState<TaskRecordDrafts>({});
  const [screenshotDrafts, setScreenshotDrafts] = useState<ScreenshotDrafts>({});
  const [submitState, setSubmitState] = useState<SubmitState>({});
  const [previewImage, setPreviewImage] = useState<{ label: string; source: string }>();
  const existingScreenshotPreviews = useMemo(
    () =>
      records.reduce<Record<string, { label: string; source?: string }>>((acc, record) => {
        const preview = getExistingScreenshotPreview(record);
        if (preview) {
          acc[record.recordId] = preview;
        }
        return acc;
      }, {}),
    [records]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDrafts(
        records.reduce<TaskRecordDrafts>((acc, record) => {
          acc[record.recordId] = readDraft(record.recordId);
          return acc;
        }, {})
      );
      setScreenshotDrafts(
        records.reduce<ScreenshotDrafts>((acc, record) => {
          const draft = readScreenshotDraft(record.recordId);
          if (draft) {
            acc[record.recordId] = draft;
          }
          return acc;
        }, {})
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [records]);

  function updateDraft<Field extends DraftField>(record: TaskRecord, field: Field, value: TaskRecordDraft[Field]) {
    const currentDraft = readDraft(record.recordId);
    const nextDraft = { ...currentDraft, [field]: value };
    writeDraft(record.recordId, nextDraft);
    setDrafts((current) => ({ ...current, [record.recordId]: nextDraft }));
  }

  async function updateScreenshotDraft(record: TaskRecord, file: File) {
    const draft = {
      dataUrl: await fileToDataUrl(file),
      name: file.name || `${record.recordId}.png`,
      type: file.type || "image/png",
    };
    writeScreenshotDraft(record.recordId, draft);
    setScreenshotDrafts((current) => ({ ...current, [record.recordId]: draft }));
  }

  function clearScreenshotDraft(record: TaskRecord) {
    removeScreenshotDraft(record.recordId);
    setScreenshotDrafts((current) => {
      const next = { ...current };
      delete next[record.recordId];
      return next;
    });
  }

  function applyRunSuggestion(record: TaskRecord, run: WorkspaceRun) {
    const nextDraft: Partial<TaskRecordDraft> = {
      ...readDraft(record.recordId),
      githubUrl: run.githubUrl,
      branchOrFolder: run.branchName,
      logs: run.logsText,
      processSatisfaction: run.aiSuggestedSatisfaction,
      unsatisfiedReason: run.aiSuggestedReason,
    };
    writeDraft(record.recordId, nextDraft);
    setDrafts((current) => ({ ...current, [record.recordId]: nextDraft }));
  }

  async function submitDraft(record: TaskRecord) {
    const draft = drafts[record.recordId] ?? {};
    const screenshotDraft = screenshotDrafts[record.recordId];
    setSubmitState((current) => ({ ...current, [record.recordId]: { status: "submitting" } }));

    const response = await fetch("/api/task-records", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: record.recordId,
        ...draft,
        screenshot: screenshotDraft
          ? {
              contentBase64: dataUrlToBase64(screenshotDraft.dataUrl),
              name: screenshotDraft.name,
              type: screenshotDraft.type,
            }
          : undefined,
      }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !payload.ok) {
      setSubmitState((current) => ({
        ...current,
        [record.recordId]: { status: "error", error: payload.error || "提交失败" },
      }));
      return;
    }

    removeDraft(record.recordId);
    clearScreenshotDraft(record);
    setDrafts((current) => ({ ...current, [record.recordId]: {} }));
    setSubmitState((current) => ({ ...current, [record.recordId]: { status: "success" } }));
  }

  return (
    <>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {TASK_RECORD_COLUMN_MAPPINGS.map((mapping) => (
            <th className="whitespace-nowrap px-5 py-3" key={mapping.taskField}>
              {mapping.taskColumn}
            </th>
          ))}
          <th className="whitespace-nowrap px-5 py-3">同步状态</th>
          {mode === "pending" ? <th className="whitespace-nowrap px-5 py-3">AI 建议</th> : null}
          {mode === "pending" ? <th className="sticky right-0 bg-slate-50 px-5 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.6)]">操作</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {records.map((record) => {
          const draft = mode === "pending" ? drafts[record.recordId] ?? {} : {};
          const isDraft =
            mode === "pending" &&
            (draftFields.some((field) => draft[field] !== undefined && draft[field] !== record[field]) || Boolean(screenshotDrafts[record.recordId]));
          const state = submitState[record.recordId] ?? { status: "idle" };
          const screenshotDraft = screenshotDrafts[record.recordId];
          const latestRun = workspaceRunsByRecord[record.recordId];
          const existingScreenshotPreview = existingScreenshotPreviews[record.recordId];
          const screenshotPreviewSource = screenshotDraft?.dataUrl ?? existingScreenshotPreview?.source;
          const screenshotLabel = screenshotDraft?.name ?? existingScreenshotPreview?.label ?? record.screenshots;

          return (
            <tr key={record.recordId}>
              {TASK_RECORD_COLUMN_MAPPINGS.map((mapping) => {
                const field = mapping.taskField as keyof TaskRecord;

                return (
                  <td className="px-5 py-4 align-top" key={mapping.taskField}>
                    {mode === "pending" && field === "round" ? (
                      <select
                        className="w-32 rounded-lg border border-slate-200 px-3 py-2"
                        defaultValue={String(renderCellValue(record, draft, "round", mode === "pending"))}
                        onChange={(event) => updateDraft(record, "round", Number(event.currentTarget.value))}
                      >
                        {roundOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : mode === "pending" &&
                      (field === "taskType" ||
                      field === "businessDomain" ||
                      field === "modifyScope" ||
                      field === "taskCompleted" ||
                      field === "processSatisfaction") ? (
                      <select
                        className="w-64 rounded-lg border border-slate-200 px-3 py-2"
                        defaultValue={renderCellValue(record, draft, field, mode === "pending") as string}
                        onChange={(event) => updateDraft(record, field, event.currentTarget.value)}
                      >
                        <option value="">待选择</option>
                        {selectOptions[field].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : mode === "pending" && field === "screenshots" ? (
                      <div
                        className="w-80 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 focus:border-blue-500 focus:outline-none"
                        onPaste={(event) => {
                          const clipboardFiles = Array.from(event.clipboardData.files);
                          const clipboardItemFiles = Array.from(event.clipboardData.items)
                            .filter((item) => item.kind === "file")
                            .map((item) => item.getAsFile())
                            .filter((file): file is File => Boolean(file));
                          const file = [...clipboardFiles, ...clipboardItemFiles].find((item) => item.type.startsWith("image/"));
                          if (file) {
                            event.preventDefault();
                            void updateScreenshotDraft(record, file);
                          }
                        }}
                        tabIndex={0}
                      >
                        <div className="flex items-center justify-between gap-3">
                          {screenshotPreviewSource ? (
                            <button className="text-left font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900" onClick={() => setPreviewImage({ label: screenshotLabel || "截图预览", source: screenshotPreviewSource })} type="button">
                              {screenshotLabel || "截图预览"}
                            </button>
                          ) : (
                            <span>{screenshotLabel || "粘贴截图或选择图片"}</span>
                          )}
                          {screenshotDraft ? (
                            <button className="text-xs text-slate-500 hover:text-slate-900" onClick={() => clearScreenshotDraft(record)} type="button">
                              移除
                            </button>
                          ) : null}
                        </div>
                        <input
                          accept="image/*"
                          className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) {
                              void updateScreenshotDraft(record, file);
                            }
                          }}
                          type="file"
                        />
                      </div>
                    ) : mode === "pending" && (field === "traeSessionId" || field === "userPrompt" || field === "unsatisfiedReason" || field === "logs") ? (
                      <textarea
                        className="h-28 w-80 rounded-lg border border-slate-200 px-3 py-2"
                        defaultValue={renderCellValue(record, draft, field, mode === "pending") as string}
                        onBlur={(event) => updateDraft(record, field, event.currentTarget.value)}
                        placeholder="待填写"
                      />
                    ) : mode === "pending" && mapping.editable ? (
                      <input
                        className="w-64 rounded-lg border border-slate-200 px-3 py-2"
                        defaultValue={renderCellValue(record, draft, field, mode === "pending") as string}
                        onBlur={(event) => updateDraft(record, mapping.taskField as DraftField, event.currentTarget.value)}
                        placeholder="待填写"
                      />
                    ) : field === "screenshots" && screenshotPreviewSource ? (
                      <button
                        className="whitespace-pre-wrap text-left font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                        onClick={() => setPreviewImage({ label: screenshotLabel || "截图预览", source: screenshotPreviewSource })}
                        type="button"
                      >
                        {screenshotLabel || "截图预览"}
                      </button>
                    ) : field === "logs" ? (
                      <div className="max-h-32 w-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">
                        {renderCellValue(record, draft, field, mode === "pending") as string}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap text-slate-700">{renderCellValue(record, draft, field, mode === "pending") as string}</span>
                    )}
                  </td>
                );
              })}
              <td className="px-5 py-4 align-top">
                <StatusBadge tone={isDraft ? "warning" : record.syncStatus === "synced" ? "success" : "neutral"}>
                  {isDraft ? "local draft" : record.syncStatus}
                </StatusBadge>
                {state.status === "error" ? <div className="mt-1 text-xs text-red-600">{state.error}</div> : null}
                {state.status === "success" ? <div className="mt-1 text-xs text-emerald-600">已提交</div> : null}
              </td>
              {mode === "pending" ? (
                <td className="px-5 py-4 align-top">
                  {latestRun ? (
                    <div className="w-80 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={latestRun.status === "analyzed" ? "success" : "warning"}>{latestRun.status}</StatusBadge>
                        {latestRun.aiConfidence ? <span>置信度：{latestRun.aiConfidence}</span> : null}
                      </div>
                      {latestRun.aiSuggestedSatisfaction ? <div className="font-medium text-slate-900">建议：{latestRun.aiSuggestedSatisfaction}</div> : null}
                      {latestRun.aiSuggestedReason ? <div className="whitespace-pre-wrap leading-5">{latestRun.aiSuggestedReason}</div> : null}
                      {latestRun.aiEvidence.length > 0 ? <div>证据：{latestRun.aiEvidence.join("；")}</div> : null}
                      <div className="break-all">{latestRun.githubUrl} · {latestRun.branchName}</div>
                      <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100" onClick={() => applyRunSuggestion(record, latestRun)} type="button">
                        应用到草稿
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">暂无运行记录</span>
                  )}
                </td>
              ) : null}
              {mode === "pending" ? (
                <td className="sticky right-0 bg-white px-5 py-4 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.6)]">
                  <button
                    className="whitespace-nowrap rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-80"
                    disabled={state.status === "submitting"}
                    onClick={() => submitDraft(record)}
                  >
                    {state.status === "submitting" ? "同步中" : "同步"}
                  </button>
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
      </table>
      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4" onClick={() => setPreviewImage(undefined)}>
          <div className="max-h-[90vh] w-full max-w-6xl rounded-2xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="truncate text-sm font-semibold text-slate-900">{previewImage.label}</h3>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setPreviewImage(undefined)} type="button">
                关闭
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={previewImage.label} className="mx-auto max-h-[80vh] max-w-full rounded-lg object-contain" src={previewImage.source} />
          </div>
        </div>
      ) : null}
    </>
  );
}
