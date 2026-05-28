"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GithubAuthCard } from "@/components/github-auth-card";
import { SoloSessionWorkbench } from "@/components/solo-workbench-page-client";
import { GITHUB_AUTH_STATUS_CHANGED_EVENT } from "@/components/workspace-create-card";
import type { GithubAuthStatus, SoloSession } from "@/lib/types";

function buildDefaultRepoName() {
  return `solo-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseRepoNames(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

type RequestState =
  | { status: "idle" }
  | { status: "checking_auth" }
  | { status: "creating" }
  | { status: "error"; error: string };

async function parseResponse<T>(response: Response) {
  const payload = (await response.json()) as { ok?: boolean; data?: T; error?: string; code?: string };
  if (!response.ok || !payload.ok || payload.data == null) {
    throw new Error(payload.code === "github_auth_required" ? "请先完成 GitHub 授权，再创建任务。" : payload.error || "请求失败");
  }
  return payload.data;
}

export function SoloWorkbenchHomeClient({ initialSessions }: { initialSessions: SoloSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [open, setOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<GithubAuthStatus | null>(null);
  const [requestState, setRequestState] = useState<RequestState>({ status: "idle" });
  const [repoNamesText, setRepoNamesText] = useState(buildDefaultRepoName);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessions[0]?.sessionId ?? "");
  const selectedSession = sessions.find((session) => session.sessionId === selectedSessionId) ?? sessions[0];

  const busy = requestState.status === "checking_auth" || requestState.status === "creating";
  const statusText = useMemo(() => {
    if (requestState.status === "checking_auth") {
      return "正在检查 GitHub 授权";
    }
    if (requestState.status === "creating") {
      return "正在本地创建任务并发起 GitHub 仓库创建";
    }
    if (requestState.status === "error") {
      return requestState.error;
    }
    return "";
  }, [requestState]);

  const refreshAuthStatus = useCallback(async () => {
    setRequestState({ status: "checking_auth" });
    const response = await fetch("/api/github-auth/status", { cache: "no-store" });
    const nextAuthStatus = await parseResponse<GithubAuthStatus>(response);
    setAuthStatus(nextAuthStatus);
    setRequestState({ status: "idle" });
    if (!nextAuthStatus.authorized) {
      window.dispatchEvent(new Event("github-auth:start"));
    }
    return nextAuthStatus;
  }, []);

  function openModal() {
    setRepoNamesText(buildDefaultRepoName());
    setRequestState({ status: "idle" });
    setOpen(true);
    void refreshAuthStatus().catch((error) => {
      setRequestState({ status: "error", error: error instanceof Error ? error.message : "GitHub 授权检查失败" });
    });
  }

  useEffect(() => {
    function handleGithubAuthStatusChanged(event: Event) {
      setAuthStatus((event as CustomEvent<GithubAuthStatus>).detail);
    }

    window.addEventListener(GITHUB_AUTH_STATUS_CHANGED_EVENT, handleGithubAuthStatusChanged);
    return () => {
      window.removeEventListener(GITHUB_AUTH_STATUS_CHANGED_EVENT, handleGithubAuthStatusChanged);
    };
  }, []);

  function updateRepoNames(value: string) {
    setRepoNamesText(value);
  }

  async function submit() {
    const repoNames = parseRepoNames(repoNamesText);
    if (repoNames.length === 0) {
      setRequestState({ status: "error", error: "请至少填写一个仓库名。" });
      return;
    }

    try {
      const latestAuthStatus = authStatus?.authorized ? authStatus : await refreshAuthStatus();
      if (!latestAuthStatus.authorized) {
        setRequestState({ status: "error", error: "请先完成 GitHub 授权，再创建任务。" });
        return;
      }

      setRequestState({ status: "creating" });
      const createdSessions = await parseResponse<SoloSession[]>(await fetch("/api/solo-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoNames }),
      }));

      const refreshedSessions = await parseResponse<SoloSession[]>(await fetch("/api/solo-tasks", { cache: "no-store" }));
      const nextSessions = refreshedSessions.length > 0 ? refreshedSessions : createdSessions;
      setSessions(nextSessions);
      setSelectedSessionId(createdSessions[0]?.sessionId ?? nextSessions[0]?.sessionId ?? "");
      setRequestState({ status: "idle" });
      setOpen(false);
    } catch (error) {
      setRequestState({ status: "error", error: error instanceof Error ? error.message : "新增任务失败" });
    }
  }

  function updateSession(nextSession: SoloSession) {
    setSessions((currentSessions) => currentSessions.map((session) => session.sessionId === nextSession.sessionId ? nextSession : session));
    setSelectedSessionId(nextSession.sessionId);
  }

  return (
    <div className="relative left-1/2 w-[calc(100vw-3rem)] max-w-[1900px] -translate-x-1/2">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px] 2xl:grid-cols-[340px_minmax(0,1fr)_420px]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-base font-semibold text-slate-950">Solo Coder 工作流</h1>
                <p className="mt-1 text-xs text-slate-500">新增任务、选择任务，并在右侧完成多轮工作流。</p>
              </div>
              <button className="shrink-0 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition hover:bg-slate-800" onClick={openModal} type="button">
                新增任务
              </button>
            </div>
          </section>

          <GithubAuthCard presentation="inline" initialStatus={authStatus} />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">任务列表</h2>
            <div className="mt-3 space-y-2">
              {sessions.length > 0 ? sessions.map((session) => {
                const active = session.sessionId === selectedSession?.sessionId;
                return (
                  <button key={session.sessionId} className={`w-full rounded-xl border p-3 text-left text-sm transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`} onClick={() => setSelectedSessionId(session.sessionId)} type="button">
                    <div className="font-semibold">{session.repoName}</div>
                    <div className="mt-1 break-all text-xs opacity-80">{session.githubUrl}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 ${active ? "bg-white/10" : "bg-slate-100"}`}>{session.currentRound} / {session.maxRounds} 轮</span>
                      <span className={`rounded-full px-2 py-1 ${active ? "bg-white/10" : "bg-slate-100"}`}>{session.repoCloned ? "已 clone" : "未 clone"}</span>
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">暂无 Solo 会话，点击“新增任务”开始。</div>
              )}
            </div>
          </section>
        </aside>

        {selectedSession ? (
          <SoloSessionWorkbench key={selectedSession.sessionId} initialSession={selectedSession} onSessionChange={updateSession} />
        ) : (
          <section className="xl:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">请先在左侧新增或选择一个任务。</section>
        )}
      </div>

      {open ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-950/10">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-950">新增任务</h2>
              <p className="mt-1 text-sm text-slate-600">创建 GitHub 仓库并生成独立 Solo 会话，不依赖旧任务表流程。</p>
            </div>
            <div className="max-h-[calc(90vh-9rem)] space-y-5 overflow-y-auto px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">GitHub 授权账号</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {authStatus?.authorized ? authStatus.accountName || "已授权" : "未授权，请完成授权后继续。"}
                    </div>
                  </div>
                  {!authStatus?.authorized ? (
                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => window.dispatchEvent(new Event("github-auth:start"))} type="button">
                      发起 GitHub 授权
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="solo-repo-names">仓库名列表</label>
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100" onClick={() => updateRepoNames(`${repoNamesText}${repoNamesText.trim() ? "\n" : ""}${buildDefaultRepoName()}`)} type="button">
                    新增随机仓库名
                  </button>
                </div>
                <textarea id="solo-repo-names" className="min-h-56 w-full rounded-lg border border-slate-200 px-3 py-2" onChange={(event) => updateRepoNames(event.currentTarget.value)} placeholder={"solo-20260526-a\nsolo-20260526-b"} value={repoNamesText} />
                <p className="text-xs text-slate-500">每行一个仓库名，会先写入本地数据库，再批量创建 public GitHub 仓库。</p>
              </div>
            </div>
            {statusText ? <div className={`border-t border-slate-100 px-6 py-4 text-sm ${requestState.status === "error" ? "text-red-600" : "text-blue-600"}`}>{statusText}</div> : null}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <button className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" disabled={busy} onClick={() => setOpen(false)} type="button">取消</button>
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !authStatus?.authorized} onClick={submit} type="button">
                {busy ? "处理中" : "确认新增"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
