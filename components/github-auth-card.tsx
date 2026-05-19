"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GITHUB_AUTH_STATUS_CHANGED_EVENT } from "@/components/workspace-create-card";
import type { GithubAuthLoginSession, GithubAuthStatus } from "@/lib/types";

const SESSION_POLL_INTERVAL_MS = 2000;

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M6.5 2.5A2.5 2.5 0 0 0 4 5v8A2.5 2.5 0 0 0 6.5 15.5h6A2.5 2.5 0 0 0 15 13V5a2.5 2.5 0 0 0-2.5-2.5h-6Zm0 1.5h6C13.052 4 13.5 4.448 13.5 5v8c0 .552-.448 1-1 1h-6c-.552 0-1-.448-1-1V5c0-.552.448-1 1-1Z" />
      <path d="M14.5 5.5a.75.75 0 0 1 1.5 0V13A4 4 0 0 1 12 17H6.5a.75.75 0 0 1 0-1.5H12A2.5 2.5 0 0 0 14.5 13V5.5Z" />
    </svg>
  );
}

type RequestState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "refreshing" }
  | { status: "logging_out" }
  | { status: "polling"; sessionId: string }
  | { status: "success"; session: GithubAuthLoginSession }
  | { status: "error"; error: string };

function formatCheckedAt(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `上次校验：${date.toLocaleString("zh-CN", { hour12: false })}`;
}

function LoadingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function AuthModal({
  open,
  session,
  copyState,
  waiting,
  onClose,
  onCopy,
  authorized,
}: {
  open: boolean;
  session: GithubAuthLoginSession | null;
  copyState: "idle" | "copied" | "error";
  waiting: boolean;
  onClose: () => void;
  onCopy: () => void;
  authorized: boolean;
}) {
  if (!open || !session) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">GitHub 授权</h2>
              <p className="mt-1 text-sm text-slate-600">打开授权链接并输入验证码，完成后回到工作台刷新状态。</p>
            </div>
            <button className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100" onClick={onClose} type="button">
              关闭
            </button>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          {session.status === "starting" ? <LoadingIndicator label="正在启动 GitHub 授权，请稍候…" /> : null}
          {waiting ? <LoadingIndicator label="正在等待 GitHub 授权结果，完成后会自动刷新状态…" /> : null}
          {authorized ? <LoadingIndicator label="GitHub 授权完成，正在关闭窗口…" /> : null}
          {session.verificationUrl ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">授权链接</div>
              <Link className="mt-1 inline-block text-sm text-blue-600 underline" href={session.verificationUrl} target="_blank" rel="noreferrer">
                {session.verificationUrl}
              </Link>
            </div>
          ) : null}
          {session.userCode ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">验证码</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="inline-flex rounded-lg bg-slate-100 px-3 py-2 font-mono text-base text-slate-950">{session.userCode}</code>
                <button
                  aria-label="复制验证码"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={onCopy}
                  type="button"
                >
                  <CopyIcon />
                </button>
                <span className="text-xs text-slate-500">{copyState === "copied" ? "已复制" : copyState === "error" ? "复制失败" : ""}</span>
              </div>
            </div>
          ) : null}
          {session.output ? <pre className="max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100 whitespace-pre-wrap">{session.output}</pre> : null}
        </div>
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.2 7.2A6.5 6.5 0 0 0 4.1 5.6L3 7.5m0 0h4m-4 0v-4M3.8 12.8a6.5 6.5 0 0 0 12.1 1.6l1.1-1.9m0 0h-4m4 0v4" />
    </svg>
  );
}

function dispatchGithubAuthStatusChanged(status: GithubAuthStatus) {
  window.dispatchEvent(new CustomEvent<GithubAuthStatus>(GITHUB_AUTH_STATUS_CHANGED_EVENT, { detail: status }));
}

const initialAuthStatus: GithubAuthStatus = {
  authorized: false,
  message: "未授权",
};

type GithubAuthCardProps = {
  presentation?: "card" | "inline";
  initialStatus?: GithubAuthStatus | null;
};

export function GithubAuthCard({ presentation = "card", initialStatus }: GithubAuthCardProps) {
  const [authStatus, setAuthStatus] = useState<GithubAuthStatus>(initialStatus ?? initialAuthStatus);
  const [requestState, setRequestState] = useState<RequestState>({ status: "idle" });
  const [session, setSession] = useState<GithubAuthLoginSession | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [modalOpen, setModalOpen] = useState(false);
  const hasLoadedInitialStatus = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollSessionRef = useRef<(sessionId: string) => Promise<void>>(async () => {});

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/github-auth/status", { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; data?: GithubAuthStatus };

    if (response.ok && payload.ok && payload.data) {
      setAuthStatus(payload.data);
      dispatchGithubAuthStatusChanged(payload.data);
      if (payload.data.authorized) {
        setSession((current) => (current ? { ...current, status: "authorized", message: "GitHub 授权完成。" } : current));
      }
      return payload.data;
    }

    const failedStatus: GithubAuthStatus = { authorized: false, message: "GitHub 授权状态获取失败" };
    setAuthStatus(failedStatus);
    dispatchGithubAuthStatusChanged(failedStatus);
    return failedStatus;
  }, []);

  const refreshStatusWithLoading = useCallback(async () => {
    setRequestState({ status: "refreshing" });

    try {
      await refreshStatus();
      setRequestState({ status: "idle" });
    } catch {
      setRequestState({ status: "error", error: "GitHub 授权状态获取失败" });
    }
  }, [refreshStatus]);

  const pollSession = useCallback(
    async (sessionId: string) => {
      clearPollTimer();

      const response = await fetch(`/api/github-auth/login/${sessionId}`, { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; error?: string; data?: GithubAuthLoginSession };

      if (!response.ok || !payload.ok || !payload.data) {
        setRequestState({ status: "error", error: payload.error || "GitHub 授权状态获取失败" });
        return;
      }

      setSession(payload.data);

      if (payload.data.status === "authorized") {
        const latestStatus = await refreshStatus();
        setRequestState({ status: "success", session: payload.data });
        setAuthStatus(latestStatus ?? { authorized: true, message: payload.data.message });
        return;
      }

      if (payload.data.status === "failed" || payload.data.status === "expired") {
        setRequestState({ status: "error", error: payload.data.message || payload.data.instructions || "GitHub 授权失败" });
        return;
      }

      setRequestState({ status: "polling", sessionId });
      pollTimerRef.current = window.setTimeout(() => {
        void pollSessionRef.current(sessionId);
      }, SESSION_POLL_INTERVAL_MS);
    },
    [clearPollTimer, refreshStatus],
  );

  useEffect(() => {
    pollSessionRef.current = pollSession;
  }, [pollSession]);

  const startAuth = useCallback(async () => {
    clearPollTimer();
    setRequestState({ status: "starting" });

    const response = await fetch("/api/github-auth/login", { method: "POST" });
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: GithubAuthLoginSession };

    if (!response.ok || !payload.ok || !payload.data) {
      setRequestState({ status: "error", error: payload.error || "GitHub 授权失败" });
      return;
    }

    setSession(payload.data);

    if (payload.data.status === "authorized") {
      const latestStatus = await refreshStatus();
      setRequestState({ status: "success", session: payload.data });
      setAuthStatus(latestStatus ?? { authorized: true, message: payload.data.message });
      return;
    }

    setAuthStatus({ authorized: false, message: "请在 GitHub 页面完成授权，完成后点击刷新状态。" });
    setCopyState("idle");
    setModalOpen(true);
    setRequestState({ status: "polling", sessionId: payload.data.sessionId });
    void pollSession(payload.data.sessionId);
  }, [clearPollTimer, pollSession, refreshStatus]);

  useEffect(() => {
    if (hasLoadedInitialStatus.current || initialStatus) {
      return;
    }

    hasLoadedInitialStatus.current = true;

    const cachedResponse = fetch("/api/github-auth/status", { method: "POST", cache: "no-store" });
    void cachedResponse.then(async (result) => {
      const payload = (await result.json()) as { ok?: boolean; data?: GithubAuthStatus | null };
      if (result.ok && payload.ok && payload.data) {
        setAuthStatus(payload.data);
        dispatchGithubAuthStatusChanged(payload.data);
      }
    });
  }, [initialStatus]);

  useEffect(() => {
    function handleStartAuth() {
      void startAuth();
    }

    window.addEventListener("github-auth:start", handleStartAuth);
    return () => {
      window.removeEventListener("github-auth:start", handleStartAuth);
    };
  }, [startAuth]);

  async function logout() {
    clearPollTimer();
    setRequestState({ status: "logging_out" });

    const response = await fetch("/api/github-auth/logout", { method: "POST" });
    const payload = (await response.json()) as { ok?: boolean; error?: string; data?: GithubAuthStatus };

    if (!response.ok || !payload.ok || !payload.data) {
      setRequestState({ status: "error", error: payload.error || "GitHub 退出登录失败" });
      return;
    }

    setAuthStatus(payload.data);
    dispatchGithubAuthStatusChanged(payload.data);
    setSession(null);
    setModalOpen(false);
    setCopyState("idle");
    setRequestState({ status: "idle" });
  }

  async function copyUserCode() {
    if (!session?.userCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.userCode);
      setCopyState("copied");
      window.setTimeout(() => {
        setCopyState("idle");
      }, 1500);
    } catch {
      setCopyState("error");
    }
  }

  const checkedAtText = formatCheckedAt(authStatus.checkedAt);
  const result =
    requestState.status === "error"
      ? requestState.error
      : requestState.status === "logging_out"
        ? "正在退出 GitHub 登录"
        : "";
  const showLogoutTag = authStatus.authorized;
  const accountLabel = authStatus.accountName || "未知账号";

  return (
    <>
      <div className={presentation === "card" ? "flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" : "flex flex-wrap items-center justify-end gap-2"}>
        {presentation === "card" ? (
          <div>
            <h3 className="text-base font-semibold text-slate-950">GitHub 授权</h3>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">使用本机 gh 登录状态创建和管理仓库。</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${authStatus.authorized ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {authStatus.authorized ? "已授权" : "未授权"}
          </span>
          {authStatus.authorized ? <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{accountLabel}</span> : null}
          {showLogoutTag ? (
            <button
              className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={requestState.status === "polling" || requestState.status === "logging_out"}
              onClick={logout}
              type="button"
            >
              退出登录
            </button>
          ) : null}
          {checkedAtText ? <span className="text-xs text-slate-400">{checkedAtText}</span> : null}
          <button
            aria-label={authStatus.authorized ? "刷新 GitHub 授权状态" : "授权 GitHub"}
            className={presentation === "card" ? "ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" : "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"}
            disabled={requestState.status === "polling" || requestState.status === "logging_out" || requestState.status === "starting" || requestState.status === "refreshing"}
            onClick={authStatus.authorized ? () => void refreshStatusWithLoading() : () => void startAuth()}
            title={authStatus.authorized ? "刷新状态" : "授权 GitHub"}
            type="button"
          >
            <RefreshIcon spinning={requestState.status === "starting" || requestState.status === "refreshing"} />
          </button>
        </div>
        {result ? <div className={`text-xs ${requestState.status === "error" ? "text-red-600" : authStatus.authorized ? "text-emerald-600" : "text-slate-500"}`}>{result}</div> : null}
      </div>
      <AuthModal
        open={modalOpen && !authStatus.authorized}
        session={session}
        copyState={copyState}
        waiting={requestState.status === "starting" || requestState.status === "polling"}
        authorized={modalOpen && authStatus.authorized}
        onClose={() => {
          clearPollTimer();
          setModalOpen(false);
        }}
        onCopy={() => void copyUserCode()}
      />
    </>
  );
}
