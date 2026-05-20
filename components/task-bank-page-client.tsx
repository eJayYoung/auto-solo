"use client";

import { Fragment, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { TableShell } from "@/components/table-shell";
import { TaskBankActions } from "@/components/task-bank-actions";
import type { TaskItem, TaskTestCaseSet } from "@/lib/types";

type TaskBankPageClientProps = {
  initialItems: TaskItem[];
  model: string;
};

type GenerateTestCasesPayload = {
  ok?: boolean;
  error?: string;
  data?: {
    items: TaskItem[];
    results: Array<{ taskId: string; status: "generated" | "skipped" | "failed"; error?: string }>;
  };
};

function parseTestCaseSet(task: TaskItem): TaskTestCaseSet | null {
  if (!task.testCasesJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(task.testCasesJson) as TaskTestCaseSet;
    return Array.isArray(parsed.testCases) ? parsed : null;
  } catch {
    return null;
  }
}

function formatTestCasesMarkdown(task: TaskItem) {
  const testCaseSet = parseTestCaseSet(task);
  if (!testCaseSet) {
    return "";
  }

  const sections = testCaseSet.testCases.map((testCase, index) => {
    const preconditions = testCase.preconditions.length ? testCase.preconditions.map((item) => `- ${item}`).join("\n") : "- 无";
    const testData = testCase.testData?.length ? testCase.testData.map((item) => `- ${item}`).join("\n") : "- 无需额外测试数据";
    const steps = testCase.steps.map((item) => `- ${item}`).join("\n");
    const checkpoints = testCase.checkpoints.map((item) => `- ${item}`).join("\n");
    return `## ${index + 1}. ${testCase.name}\n\n- 类型：${testCase.type}\n- 严重级别：${testCase.severity}\n- 输入：${testCase.input || "无"}\n\n前置条件：\n${preconditions}\n\n测试数据：\n${testData}\n\n操作步骤：\n${steps}\n\n预期结果：\n${testCase.expected}\n\n检查点：\n${checkpoints}`;
  });

  return `# ${task.title} - 测试用例\n\n${testCaseSet.summary}\n\n${sections.join("\n\n")}\n\n备注：${testCaseSet.notes || "无"}`;
}

export function TaskBankPageClient({ initialItems, model }: TaskBankPageClientProps) {
  const [taskItems, setTaskItems] = useState<TaskItem[]>(initialItems);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [promptFilter, setPromptFilter] = useState<"all" | "history" | "new">("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [generatingTaskIds, setGeneratingTaskIds] = useState<string[]>([]);
  const [selectedTestCaseTaskId, setSelectedTestCaseTaskId] = useState<string | null>(null);
  const [testCaseErrors, setTestCaseErrors] = useState<Record<string, string>>({});

  const sortedItems = useMemo(
    () => [...taskItems].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))),
    [taskItems],
  );

  const filterCounts = useMemo(() => {
    const newCount = sortedItems.filter((task) => !task.uidBinding || task.uidBinding === "待绑定").length;
    const historyCount = sortedItems.length - newCount;
    return {
      all: sortedItems.length,
      history: historyCount,
      new: newCount,
    };
  }, [sortedItems]);

  const filteredItems = useMemo(() => {
    if (promptFilter === "all") {
      return sortedItems;
    }

    return sortedItems.filter((task) => {
      const isNewPrompt = !task.uidBinding || task.uidBinding === "待绑定";
      return promptFilter === "new" ? isNewPrompt : !isNewPrompt;
    });
  }, [promptFilter, sortedItems]);

  const selectedTestCaseTask = selectedTestCaseTaskId ? taskItems.find((task) => task.taskId === selectedTestCaseTaskId) ?? null : null;
  const selectedTestCaseSet = selectedTestCaseTask ? parseTestCaseSet(selectedTestCaseTask) : null;

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => setToastMessage((previous) => (previous === message ? null : previous)), 1500);
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("复制成功");
    } catch {
      setToastMessage(null);
    }
  }

  function toggleSelectedTask(taskId: string) {
    setSelectedTaskIds((current) => (current.includes(taskId) ? current.filter((item) => item !== taskId) : [...current, taskId]));
  }

  function toggleAllFilteredTasks() {
    const filteredIds = filteredItems.map((task) => task.taskId);
    const allSelected = filteredIds.length > 0 && filteredIds.every((taskId) => selectedTaskIds.includes(taskId));
    setSelectedTaskIds((current) => (allSelected ? current.filter((taskId) => !filteredIds.includes(taskId)) : [...new Set([...current, ...filteredIds])]));
  }

  function handlePromptFilterChange(nextFilter: "all" | "history" | "new") {
    setPromptFilter(nextFilter);
    setSelectedTaskIds([]);
  }

  async function handleGenerateTestCases(taskIds: string[], overwrite = false) {
    if (taskIds.length === 0) {
      return;
    }

    setGeneratingTaskIds((current) => [...new Set([...current, ...taskIds])]);
    setTestCaseErrors((current) => {
      const next = { ...current };
      taskIds.forEach((taskId) => delete next[taskId]);
      return next;
    });

    try {
      const response = await fetch("/api/task-bank/test-cases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds, model, overwrite }),
      });
      const payload = (await response.json()) as GenerateTestCasesPayload;

      if (!response.ok || !payload.ok || !payload.data) {
        const error = payload.error || "生成测试用例失败";
        setTestCaseErrors((current) => ({ ...current, ...Object.fromEntries(taskIds.map((taskId) => [taskId, error])) }));
        return;
      }

      setTaskItems(payload.data.items);
      const failed = payload.data.results.filter((result) => result.status === "failed");
      if (failed.length > 0) {
        setTestCaseErrors((current) => ({
          ...current,
          ...Object.fromEntries(failed.map((result) => [result.taskId, result.error || "生成测试用例失败"])),
        }));
        showToast(`生成完成，${failed.length} 条失败`);
        return;
      }

      const generatedCount = payload.data.results.filter((result) => result.status === "generated").length;
      showToast(generatedCount > 0 ? "测试用例已生成" : "已跳过已有测试用例");
    } catch {
      setTestCaseErrors((current) => ({ ...current, ...Object.fromEntries(taskIds.map((taskId) => [taskId, "生成测试用例失败，请检查网络或服务状态"])) }));
    } finally {
      setGeneratingTaskIds((current) => current.filter((taskId) => !taskIds.includes(taskId)));
    }
  }

  async function handleGeneratedInsert(items: TaskItem[]) {
    const response = await fetch("/api/task-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const payload = (await response.json()) as { ok?: boolean; data?: TaskItem[] };

    if (!response.ok || !payload.ok || !payload.data) {
      return;
    }

    setTaskItems(payload.data);
  }

  async function handleDelete(taskId: string) {
    const confirmed = window.confirm("确认删除该题目吗？删除后不可恢复。");
    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/task-bank", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const payload = (await response.json()) as { ok?: boolean; data?: TaskItem[] };

    if (!response.ok || !payload.ok || !payload.data) {
      return;
    }

    setTaskItems(payload.data);
    showToast("删除成功");
  }

  return (
    <div className="space-y-6">
      {toastMessage ? (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">{toastMessage}</div>
      ) : null}

      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">题库表</h1>
          <p className="mt-2 text-sm text-slate-600">沉淀历史第一轮 User Prompt，支持 CRUD、批量生成、复制和 AI 测试用例检查。</p>
        </div>
        <TaskBankActions model={model} onConfirmInsert={handleGeneratedInsert} />
      </section>

      <TableShell title="题目列表" description="已提交题目不可删除，只能归档或隐藏。">
        <div className="mb-3 flex flex-col gap-3 px-5 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-slate-500">AI 测试用例是辅助检查点，不是绝对标准答案；请结合题目需求和实际产物判断。</div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:text-slate-300"
              type="button"
              disabled={selectedTaskIds.length === 0 || generatingTaskIds.length > 0}
              onClick={() => void handleGenerateTestCases(selectedTaskIds)}
            >
              批量生成用例（{selectedTaskIds.length}）
            </button>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
            {[
              { value: "all", label: "全部 Prompt", count: filterCounts.all },
              { value: "history", label: "历史 Prompt", count: filterCounts.history },
              { value: "new", label: "新增 Prompt（未绑定 UID）", count: filterCounts.new },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-md px-3 py-1.5 transition ${
                  promptFilter === option.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => handlePromptFilterChange(option.value as "all" | "history" | "new")}
              >
                {option.label}（{option.count}）
              </button>
            ))}
          </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">
                  <input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((task) => selectedTaskIds.includes(task.taskId))} onChange={toggleAllFilteredTasks} />
                </th>
                <th className="px-5 py-3">题目</th>
                <th className="px-5 py-3">绑定 UID</th>
                <th className="px-5 py-3">模型</th>
                <th className="px-5 py-3">来源</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">测试用例</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((task, index) => (
                <Fragment key={task.taskId}>
                  {index === 0 && taskItems.length > initialItems.length ? (
                    <tr>
                      <td className="px-5 py-3 text-xs font-medium text-emerald-700" colSpan={8}>
                        本次新增题目
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="px-5 py-4">
                      <input type="checkbox" checked={selectedTaskIds.includes(task.taskId)} onChange={() => toggleSelectedTask(task.taskId)} />
                    </td>
                    <td className="min-w-96 px-5 py-4">
                      <div className="font-medium text-slate-950">{task.title}</div>
                      <div className="mt-1 line-clamp-4 text-slate-600">{task.promptContent}</div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">{task.uidBinding || "待绑定"}</td>
                    <td className="whitespace-nowrap px-5 py-4">{task.model}</td>
                    <td className="px-5 py-4">{task.sourceType}</td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={task.status === "submitted" ? "success" : "neutral"}>{task.status}</StatusBadge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1 whitespace-nowrap text-xs">
                        {generatingTaskIds.includes(task.taskId) ? <StatusBadge tone="warning">生成中</StatusBadge> : task.testCasesJson ? <StatusBadge tone="success">已生成</StatusBadge> : <StatusBadge tone="neutral">未生成</StatusBadge>}
                        {testCaseErrors[task.taskId] ? <div className="max-w-48 whitespace-normal text-red-600">{testCaseErrors[task.taskId]}</div> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2 whitespace-nowrap">
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" onClick={() => void handleCopy(task.promptContent)}>
                          复制
                        </button>
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:text-slate-300"
                          disabled={generatingTaskIds.includes(task.taskId)}
                          onClick={() => void handleGenerateTestCases([task.taskId], Boolean(task.testCasesJson))}
                        >
                          {task.testCasesJson ? "重新生成" : "生成用例"}
                        </button>
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:text-slate-300"
                          disabled={!task.testCasesJson}
                          onClick={() => setSelectedTestCaseTaskId(task.taskId)}
                        >
                          查看用例
                        </button>
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs disabled:text-slate-300"
                          disabled={!task.testCasesJson}
                          onClick={() => void handleCopy(formatTestCasesMarkdown(task))}
                        >
                          复制用例
                        </button>
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                          disabled={task.status === "submitted"}
                          onClick={() => void handleDelete(task.taskId)}
                        >
                          {task.status === "submitted" ? "不可删除" : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </TableShell>

      {selectedTestCaseTask ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="测试用例详情">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-950">{selectedTestCaseTask.title} - 测试用例</div>
                <div className="mt-1 text-xs text-slate-500">{selectedTestCaseTask.testCasesModel ? `生成模型：${selectedTestCaseTask.testCasesModel}` : "AI 生成测试用例"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" type="button" onClick={() => void handleCopy(formatTestCasesMarkdown(selectedTestCaseTask))}>
                  复制用例
                </button>
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" type="button" onClick={() => setSelectedTestCaseTaskId(null)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="max-h-[calc(85vh-88px)] overflow-y-auto p-5">
              {!selectedTestCaseSet ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">测试用例格式异常，请重新生成。</div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-medium text-slate-950">{selectedTestCaseSet.summary}</div>
                    {selectedTestCaseSet.notes ? <div className="mt-1 text-xs text-slate-500">{selectedTestCaseSet.notes}</div> : null}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {selectedTestCaseSet.testCases.map((testCase, testCaseIndex) => (
                      <div key={`${selectedTestCaseTask.taskId}-${testCaseIndex}`} className="rounded-lg border border-slate-200 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{testCase.name}</div>
                          <div className="text-xs text-slate-500">{testCase.type} · {testCase.severity}</div>
                        </div>
                        <div className="mt-3 text-xs text-slate-600">输入：{testCase.input || "无"}</div>
                        {testCase.preconditions.length > 0 ? <div className="mt-2 text-xs text-slate-600">前置条件：{testCase.preconditions.join(" / ")}</div> : null}
                        <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                          <div className="font-medium">测试数据</div>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {(testCase.testData?.length ? testCase.testData : ["无需额外测试数据"]).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-2 text-xs text-slate-600">预期：{testCase.expected}</div>
                        <div className="mt-2 text-xs text-slate-500">步骤：{testCase.steps.join(" / ")}</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                          {testCase.checkpoints.map((checkpoint) => (
                            <li key={checkpoint}>{checkpoint}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
