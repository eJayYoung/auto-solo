"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TaskRecordsTable } from "@/components/task-records-table";
import type { TaskRecord, WorkspaceRun } from "@/lib/types";

const permissionLinkPattern = /https:\/\/open\.feishu\.cn\/[^\s，。]+/;

type TaskRecordsPanelProps = {
  initialRecords: TaskRecord[];
  initialWorkspaceRunsByRecord: Record<string, WorkspaceRun>;
};

type TaskRecordTab = "reviewed" | "pending" | "rejected";

function isReviewedRecord(record: TaskRecord) {
  return record.qcStatus.includes("ai质检通过");
}

function isRejectedRecord(record: TaskRecord) {
  return record.qcStatus.includes("不通过");
}

export function TaskRecordsPanel({ initialRecords, initialWorkspaceRunsByRecord }: TaskRecordsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasAutoSyncedRef = useRef(false);
  const [records, setRecords] = useState(initialRecords);
  const [activeTab, setActiveTab] = useState<TaskRecordTab>("pending");
  const [message, setMessage] = useState<string>();
  const [permissionError, setPermissionError] = useState<{ message: string; url: string }>();
  const [isPending, startTransition] = useTransition();

  const reviewedCount = useMemo(() => records.filter(isReviewedRecord).length, [records]);
  const rejectedCount = useMemo(() => records.filter(isRejectedRecord).length, [records]);
  const pendingCount = useMemo(() => records.length - reviewedCount - rejectedCount, [records, reviewedCount, rejectedCount]);
  const filteredRecords = useMemo(
    () => records.filter((record) => {
      if (activeTab === "reviewed") {
        return isReviewedRecord(record);
      }
      if (activeTab === "rejected") {
        return isRejectedRecord(record);
      }
      return !isReviewedRecord(record) && !isRejectedRecord(record);
    }),
    [activeTab, records]
  );
  const shortMessage = useMemo(() => {
    if (!permissionError) {
      return undefined;
    }
    return permissionError.message.split("，点击链接")[0];
  }, [permissionError]);

  function syncRecords() {
    startTransition(async () => {
      setMessage(undefined);
      setPermissionError(undefined);
      const response = await fetch("/api/task-records/sync", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; records?: TaskRecord[]; count?: number; error?: string };

      if (!response.ok || !payload.ok || !payload.records) {
        const error = payload.error || "同步失败";
        const permissionUrl = error.match(permissionLinkPattern)?.[0];
        if (permissionUrl) {
          setPermissionError({ message: error, url: permissionUrl });
          return;
        }
        setMessage(error);
        return;
      }

      setRecords(payload.records);
      setMessage(`同步成功，共 ${payload.count ?? payload.records.length} 条记录`);
    });
  }

  useEffect(() => {
    if (searchParams.get("action") !== "sync-feishu" || hasAutoSyncedRef.current) {
      return;
    }

    hasAutoSyncedRef.current = true;
    syncRecords();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("action");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <>
      <section className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">表格操作</h2>
          <p className="mt-1 text-sm text-slate-600">拉取最新任务记录并刷新当前页面。</p>
          {message ? <p className="mt-2 text-sm text-slate-500">{message}</p> : null}
        </div>
        <button
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
          onClick={syncRecords}
          type="button"
        >
          {isPending ? "同步中..." : "一键同步飞书表格"}
        </button>
      </section>
      <section className="flex gap-2 border-b border-slate-200 px-5 py-3">
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === "reviewed" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
          onClick={() => setActiveTab("reviewed")}
          type="button"
        >
          已审核数据（{reviewedCount}）
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === "pending" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
          onClick={() => setActiveTab("pending")}
          type="button"
        >
          待提交数据（{pendingCount}）
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === "rejected" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
          onClick={() => setActiveTab("rejected")}
          type="button"
        >
          不通过数据（{rejectedCount}）
        </button>
      </section>
      <div className="overflow-x-auto">
        <TaskRecordsTable mode={activeTab} records={filteredRecords} workspaceRunsByRecord={initialWorkspaceRunsByRecord} />
      </div>
      {permissionError ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">需要开通飞书表格权限</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {shortMessage || "当前飞书应用尚未开通读取多维表格记录的权限。"}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">请点击下方链接跳转到飞书开放平台完成授权，授权后回到本页重新同步。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700" onClick={() => setPermissionError(undefined)}>
                关闭
              </button>
              <a
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                href={permissionError.url}
                rel="noreferrer"
                target="_blank"
              >
                前往授权
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
