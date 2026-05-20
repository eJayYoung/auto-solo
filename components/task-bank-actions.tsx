"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BUSINESS_DOMAIN_OPTIONS, MODEL_OPTIONS, TASK_DIFFICULTY_OPTIONS, TASK_GENERATION_BASE_PROMPT } from "@/lib/constants";
import type { TaskDifficulty, TaskItem } from "@/lib/types";

type GenerateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; count: number }
  | { status: "error"; error: string };

type TaskBankActionsProps = {
  model: string;
  onConfirmInsert: (items: TaskItem[]) => void;
  openToken?: number;
  onOpenTokenHandled?: (token: number) => void;
  hideTrigger?: boolean;
};

export function TaskBankActions({ model, onConfirmInsert, openToken, onOpenTokenHandled, hideTrigger = false }: TaskBankActionsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [generateState, setGenerateState] = useState<GenerateState>({ status: "idle" });
  const [previewItems, setPreviewItems] = useState<TaskItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<"append" | "override">("append");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<TaskDifficulty | "">("");
  const [selectedModel, setSelectedModel] = useState(model);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [basePrompt, setBasePrompt] = useState(TASK_GENERATION_BASE_PROMPT);
  const [userPrompt, setUserPrompt] = useState("");
  const action = searchParams.get("action");
  const externalDialogOpen = openToken !== undefined;
  const dialogOpen = isDialogOpen || action === "create-task" || externalDialogOpen;

  async function handleGenerate() {
    setGenerateState({ status: "loading" });
    const response = await fetch("/api/task-bank/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, model: selectedModel, promptMode, basePrompt, userPrompt, businessDomains: selectedDomains, difficulty: difficulty || undefined }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: TaskItem[] };

    if (!response.ok || !payload.ok || !payload.data) {
      setGenerateState({ status: "error", error: payload.error || "生成失败" });
      return;
    }

    setPreviewItems(payload.data);
    setGenerateState({ status: "success", count: payload.data.length });
  }

  function toggleDomain(domain: string) {
    setSelectedDomains((current) => (current.includes(domain) ? current.filter((item) => item !== domain) : [...current, domain]));
  }

  function closeDialog() {
    if (openToken !== undefined) {
      onOpenTokenHandled?.(openToken);
    }
    setIsDialogOpen(false);
  }

  function handleConfirmInsert() {
    if (previewItems.length === 0) {
      return;
    }
    onConfirmInsert(previewItems);
    setPreviewItems([]);
    setGenerateState({ status: "idle" });
    closeDialog();
  }

  function handleCloseDialog() {
    closeDialog();
    setPreviewItems([]);
    setGenerateState({ status: "idle" });
  }

  function handleDeletePreviewItem(taskId: string) {
    setPreviewItems((current) => current.filter((item) => item.taskId !== taskId));
  }

  return (
    <div className="space-y-4">
      {hideTrigger ? null : (
        <div className="flex gap-3">
          <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white" type="button" onClick={() => setIsDialogOpen(true)}>
            创建题目
          </button>
        </div>
      )}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {action === "create-task"
            ? (() => {
                const nextParams = new URLSearchParams(searchParams.toString());
                nextParams.delete("action");
                const nextQuery = nextParams.toString();
                router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
                return null;
              })()
            : null}
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-950">生成题目</h3>
            </div>
            <div className="max-h-[calc(90vh-8rem)] space-y-4 overflow-auto px-5 py-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <div className="mb-1 text-xs text-slate-500">生成模型</div>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={selectedModel} onChange={(event) => setSelectedModel(event.currentTarget.value)}>
                    {MODEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-slate-500">提示词模式</div>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={promptMode}
                    onChange={(event) => setPromptMode(event.currentTarget.value as "append" | "override")}
                  >
                    <option value="append">追加模式</option>
                    <option value="override">覆盖模式</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1 text-xs text-slate-500">生成数量</div>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={count}
                    onChange={(event) => setCount(Math.min(20, Math.max(1, Number(event.currentTarget.value) || 1)))}
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs text-slate-500">题目难度</div>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={difficulty} onChange={(event) => setDifficulty(event.currentTarget.value as TaskDifficulty | "")}>
                    <option value="">不限难度</option>
                    {TASK_DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">业务领域（任一皆可）</div>
                  <button className="text-xs text-slate-500 hover:text-slate-900 disabled:text-slate-300" type="button" disabled={selectedDomains.length === 0} onClick={() => setSelectedDomains([])}>
                    清空选择
                  </button>
                </div>
                <div className="grid overflow-hidden rounded-lg border border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
                  {BUSINESS_DOMAIN_OPTIONS.map((domain) => {
                    const selected = selectedDomains.includes(domain);
                    return (
                      <button
                        key={domain}
                        className={`border-b border-r border-slate-200 px-3 py-3 text-left text-sm transition last:border-b-0 lg:[&:nth-child(4n)]:border-r-0 ${selected ? "bg-slate-950 text-white" : "bg-white text-slate-800 hover:bg-slate-50"}`}
                        type="button"
                        onClick={() => toggleDomain(domain)}
                      >
                        {domain}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">内置提示词</div>
                  <button
                    className="text-xs text-slate-500 hover:text-slate-900 disabled:text-slate-300"
                    type="button"
                    disabled={basePrompt === TASK_GENERATION_BASE_PROMPT}
                    onClick={() => setBasePrompt(TASK_GENERATION_BASE_PROMPT)}
                  >
                    恢复默认
                  </button>
                </div>
                <textarea
                  className="h-48 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                  value={basePrompt}
                  onChange={(event) => setBasePrompt(event.currentTarget.value)}
                />
                <div className="mt-1 text-xs text-slate-400">可编辑生成规则，建议保留 JSON 输出格式要求。</div>
              </div>

              <div>
                <div className="mb-1 text-xs text-slate-500">用户提示词</div>
                <textarea
                  className="h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="输入你希望补充的约束，例如难度、改动范围等"
                  value={userPrompt}
                  onChange={(event) => setUserPrompt(event.currentTarget.value)}
                />
              </div>

              {generateState.status === "error" ? <p className="text-xs text-red-600">{generateState.error}</p> : null}

              {previewItems.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-medium text-slate-900">生成预览（确认后插入题库）</h4>
                  <ul className="mt-3 max-h-64 space-y-3 overflow-auto">
                    {previewItems.map((item) => (
                      <li key={item.taskId} className="rounded-lg border border-slate-100 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-slate-900">{item.title}</div>
                              {item.difficulty ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{TASK_DIFFICULTY_OPTIONS.find((option) => option.value === item.difficulty)?.label ?? item.difficulty}</span> : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-600">{item.promptContent}</div>
                          </div>
                          <button className="shrink-0 rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" type="button" onClick={() => handleDeletePreviewItem(item.taskId)}>
                            删除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" type="button" onClick={handleCloseDialog}>
                取消
              </button>
              {previewItems.length === 0 ? (
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  type="button"
                  onClick={handleGenerate}
                  disabled={generateState.status === "loading"}
                >
                  {generateState.status === "loading" ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      生成中...
                    </>
                  ) : (
                    "生成"
                  )}
                </button>
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateState.status === "loading"}
                  >
                    {generateState.status === "loading" ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                        重新生成中...
                      </>
                    ) : (
                      "重新生成"
                    )}
                  </button>
                  <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="button" onClick={handleConfirmInsert} disabled={generateState.status === "loading"}>
                    确认插入题库
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {generateState.status === "success" && previewItems.length > 0 ? <p className="text-xs text-emerald-600">已生成 {generateState.count} 条题目，请确认是否插入</p> : null}
    </div>
  );
}
