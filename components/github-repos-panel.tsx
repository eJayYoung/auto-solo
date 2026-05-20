"use client";

import { useEffect, useState } from "react";
import { CopyUrlButton } from "@/components/copy-url-button";
import type { GithubAuthStatus } from "@/lib/types";

type GithubRepoItem = {
  name: string;
  fullName: string;
  httpsUrl: string;
  localPath?: string;
  submitted: boolean;
};

type GithubReposResponse = {
  ok: boolean;
  data?: {
    accountName: string;
    repos: GithubRepoItem[];
  };
  error?: string;
};

type DeleteRepoResponse = {
  ok: boolean;
  error?: string;
};

type OpenTraeResponse = {
  ok: boolean;
  error?: string;
};

const GITHUB_AUTH_STATUS_CHANGED_EVENT = "github-auth:status-changed";

type LoadState =
  | { status: "loading" }
  | { status: "unauthorized"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; accountName: string; repos: GithubRepoItem[]; errorMessage?: string; loadingRepos?: boolean };

type GithubReposPanelProps = {
  initialAuthStatus?: GithubAuthStatus | null;
};

function buildInitialState(initialAuthStatus?: GithubAuthStatus | null): LoadState {
  if (!initialAuthStatus?.authorized) {
    return { status: "unauthorized", message: initialAuthStatus?.message || "请先授权 GitHub" };
  }

  return { status: "success", accountName: initialAuthStatus.accountName || "Unknown", repos: [], loadingRepos: true };
}

export function GithubReposPanel({ initialAuthStatus }: GithubReposPanelProps) {
  const [state, setState] = useState<LoadState>(() => buildInitialState(initialAuthStatus));
  const [deletingRepoFullName, setDeletingRepoFullName] = useState<string | null>(null);
  const [openingRepoFullName, setOpeningRepoFullName] = useState<string | null>(null);

  async function loadRepos(options?: { preserveCurrentOnError?: boolean; showLoading?: boolean }) {
    const preserveCurrentOnError = options?.preserveCurrentOnError ?? false;
    if (options?.showLoading) {
      setState((current) =>
        current.status === "success"
          ? { ...current, errorMessage: undefined, loadingRepos: true }
          : { status: "loading" },
      );
    }

    try {
      const response = await fetch("/api/github/repos", { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as GithubReposResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        if (response.status === 401) {
          setState({ status: "unauthorized", message: payload.error || "请先授权 GitHub" });
          return;
        }

        if (preserveCurrentOnError) {
          setState((current) => {
            if (current.status !== "success") {
              return current;
            }
            return { ...current, errorMessage: payload.error || "读取 GitHub 仓库失败", loadingRepos: false };
          });
          return;
        }

        setState({ status: "error", message: payload.error || "读取 GitHub 仓库失败" });
        return;
      }

      setState({
        status: "success",
        accountName: payload.data.accountName,
        repos: payload.data.repos,
        loadingRepos: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取 GitHub 仓库失败";

      if (preserveCurrentOnError) {
        setState((current) => {
          if (current.status !== "success") {
            return current;
          }
          return { ...current, errorMessage: message, loadingRepos: false };
        });
        return;
      }

      setState({ status: "error", message });
    }
  }

  useEffect(() => {
    if (!initialAuthStatus?.authorized) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadRepos({ preserveCurrentOnError: true });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [initialAuthStatus]);
  useEffect(() => {
    function handleAuthStatusChanged(event: Event) {
      const status = (event as CustomEvent<GithubAuthStatus>).detail;
      if (!status.authorized) {
        setState({ status: "unauthorized", message: status.message || "请先授权 GitHub" });
        return;
      }

      setState({ status: "success", accountName: status.accountName || "Unknown", repos: [], loadingRepos: true });
      void loadRepos({ preserveCurrentOnError: true, showLoading: true });
    }

    window.addEventListener(GITHUB_AUTH_STATUS_CHANGED_EVENT, handleAuthStatusChanged);
    return () => {
      window.removeEventListener(GITHUB_AUTH_STATUS_CHANGED_EVENT, handleAuthStatusChanged);
    };
  }, []);

  async function handleOpenTrae(repo: GithubRepoItem) {
    if (openingRepoFullName || !repo.localPath) {
      return;
    }

    setOpeningRepoFullName(repo.fullName);

    try {
      const response = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open-trae", repoFullName: repo.fullName }),
      });
      const payload = (await response.json()) as OpenTraeResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.error || "打开 Trae 失败";
        setState((current) => {
          if (current.status !== "success") {
            return current;
          }
          return { ...current, errorMessage: message, loadingRepos: false };
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "打开 Trae 失败";
      setState((current) => {
        if (current.status !== "success") {
          return current;
        }
        return { ...current, errorMessage: message };
      });
    } finally {
      setOpeningRepoFullName(null);
    }
  }

  async function handleDeleteRepo(repo: GithubRepoItem) {
    if (deletingRepoFullName) {
      return;
    }

    if (!window.confirm(`确认删除远程仓库 ${repo.fullName} 吗？此操作不可恢复。`)) {
      return;
    }

    setDeletingRepoFullName(repo.fullName);

    try {
      const response = await fetch("/api/github/repos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: repo.fullName }),
      });
      const payload = (await response.json()) as DeleteRepoResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.error || "删除 GitHub 仓库失败";
        setState((current) => {
          if (current.status !== "success") {
            return current;
          }
          return { ...current, errorMessage: message, loadingRepos: false };
        });
        return;
      }

      await loadRepos({ preserveCurrentOnError: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除 GitHub 仓库失败";
      setState((current) => {
        if (current.status !== "success") {
          return current;
        }
        return { ...current, errorMessage: message };
      });
    } finally {
      setDeletingRepoFullName(null);
    }
  }

  if (state.status === "loading") {
    return <p className="text-sm text-slate-600">读取 GitHub 仓库列表中...</p>;
  }

  if (state.status === "unauthorized") {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="text-sm">{state.message}</p>
        <p className="text-sm">请先在本页面上方完成 GitHub 授权，然后刷新仓库列表。</p>
        <button className="text-sm underline" onClick={() => void loadRepos()} type="button">
          刷新列表
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <p className="text-sm">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {state.errorMessage ? (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="text-sm">{state.errorMessage}</p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">仓库名称</th>
              <th className="px-4 py-3 font-medium">HTTPS 地址</th>
              <th className="px-4 py-3 font-medium">提报状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.loadingRepos ? (
              <>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`repo-loading-${index}`}>
                    <td className="px-4 py-4">
                      <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              </>
            ) : state.repos.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  当前账号下暂无仓库。
                </td>
              </tr>
            ) : (
              state.repos.map((repo) => (
                <tr key={repo.fullName}>
                  <td className="px-4 py-3 text-slate-900">{repo.name}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <a className="underline" href={repo.httpsUrl} target="_blank" rel="noreferrer">
                      {repo.httpsUrl}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        repo.submitted
                          ? "inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                          : "inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
                      }
                    >
                      {repo.submitted ? "已提报" : "未提报"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CopyUrlButton value={repo.httpsUrl} />
                      <button
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => handleOpenTrae(repo)}
                        disabled={!repo.localPath || Boolean(openingRepoFullName)}
                        title={repo.localPath ? `打开 ${repo.localPath}` : "未找到本地目录，请先 clone 仓库"}
                      >
                        {openingRepoFullName === repo.fullName ? "打开中..." : "用 Trae 打开"}
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => handleDeleteRepo(repo)}
                        disabled={Boolean(deletingRepoFullName)}
                      >
                        {deletingRepoFullName === repo.fullName ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
