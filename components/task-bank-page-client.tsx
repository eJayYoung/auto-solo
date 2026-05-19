"use client";

import { Fragment, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { TableShell } from "@/components/table-shell";
import { TaskBankActions } from "@/components/task-bank-actions";
import type { TaskItem } from "@/lib/types";

type TaskBankPageClientProps = {
  initialItems: TaskItem[];
  model: string;
};

export function TaskBankPageClient({ initialItems, model }: TaskBankPageClientProps) {
  const [taskItems, setTaskItems] = useState<TaskItem[]>(initialItems);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [promptFilter, setPromptFilter] = useState<"all" | "history" | "new">("all");

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

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => setToastMessage((previous) => (previous === message ? null : previous)), 1500);
  }

  async function handleCopy(promptContent: string) {
    try {
      await navigator.clipboard.writeText(promptContent);
      showToast("复制成功");
    } catch {
      setToastMessage(null);
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
          <p className="mt-2 text-sm text-slate-600">沉淀历史第一轮 User Prompt，支持 CRUD、批量生成和复制。</p>
        </div>
        <TaskBankActions model={model} onConfirmInsert={handleGeneratedInsert} />
      </section>

      <TableShell title="题目列表" description="已提交题目不可删除，只能归档或隐藏。">
        <div className="mb-3 flex items-center justify-end px-5 pt-4">
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
                onClick={() => setPromptFilter(option.value as "all" | "history" | "new")}
              >
                {option.label}（{option.count}）
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">题目</th>
                <th className="px-5 py-3">绑定 UID</th>
                <th className="px-5 py-3">模型</th>
                <th className="px-5 py-3">来源</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((task, index) => (
                <Fragment key={task.taskId}>
                  {index === 0 && taskItems.length > initialItems.length ? (
                    <tr>
                      <td className="px-5 py-3 text-xs font-medium text-emerald-700" colSpan={6}>
                        本次新增题目
                      </td>
                    </tr>
                  ) : null}
                  <tr>
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
                      <div className="flex gap-2 whitespace-nowrap">
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs" onClick={() => void handleCopy(task.promptContent)}>
                          复制
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
    </div>
  );
}
