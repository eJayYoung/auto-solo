"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionCard } from "@/components/action-card";
import { StatusBadge } from "@/components/status-badge";
import type { CreateWorkspaceBatchInput, CreateWorkspaceTargetRecord, GithubAuthStatus, UserSettings, WorkspaceProjectBatchResult } from "@/lib/types";

export const GITHUB_AUTH_STATUS_CHANGED_EVENT = "github-auth:status-changed";

const GITHUB_AUTH_START_EVENT = "github-auth:start";

type WorkspaceCreateCardProps = {
  settings: UserSettings;
  targetRecords?: CreateWorkspaceTargetRecord[];
  onBackfillApplied?: () => void;
  presentation?: "card" | "inline";
  initialAuthStatus?: GithubAuthStatus | null;
};

type RequestState =
  | { status: "idle" }
  | { status: "checking_auth" }
  | { status: "creating_repo" }
  | { status: "success"; result: WorkspaceProjectBatchResult }
  | { status: "error"; error: string; step: "checking_auth" | "creating_repo" };

function buildDefaultRepoName() {
  return `solo-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6)}`;
}

function getDefaultGithubOwner(settings: UserSettings, authStatus: GithubAuthStatus | null) {
  return authStatus?.authorized && authStatus.accountName ? authStatus.accountName : settings.githubOwner;
}

function buildInitialForm(settings: UserSettings, authStatus: GithubAuthStatus | null): CreateWorkspaceBatchInput {
  return {
    taskId: "MANUAL",
    repoNames: [buildDefaultRepoName()],
    githubOwner: getDefaultGithubOwner(settings, authStatus),
    visibility: settings.repoVisibility,
    localRoot: settings.localRoot,
    cloneEnabled: settings.cloneEnabled,
    openTraeEnabled: settings.openTraeEnabled,
    traeAppName: settings.traeAppName,
    targetRecords: [],
  };
}

function buildRepoNamesText(repoNames: string[]) {
  return repoNames.join("\n");
}

function parseRepoNames(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildStepMeta(requestState: RequestState, form: CreateWorkspaceBatchInput) {
  if (requestState.status === "checking_auth") {
    return {
      tone: "warning" as const,
      badgeLabel: "进行中",
      title: "正在检查 GitHub 授权",
      description: "正在确认当前 gh 登录状态，校验通过后会开始批量创建仓库。",
    };
  }

  if (requestState.status === "creating_repo") {
    return {
      tone: "warning" as const,
      badgeLabel: "进行中",
      title: "正在批量创建 GitHub 仓库",
      description: `正在并发创建 ${form.repoNames.length} 个仓库。`,
    };
  }

  if (requestState.status === "success") {
    const hasFailure = requestState.result.failureCount > 0;
    return {
      tone: hasFailure ? ("warning" as const) : ("success" as const),
      badgeLabel: hasFailure ? "部分完成" : "已完成",
      title: hasFailure ? "批量创建已完成，部分仓库失败" : "批量创建已完成",
      description: `成功 ${requestState.result.successCount} 个，失败 ${requestState.result.failureCount} 个。`,
    };
  }

  if (requestState.status === "error") {
    return {
      tone: "danger" as const,
      badgeLabel: "失败",
      title: requestState.step === "checking_auth" ? "GitHub 授权检查失败" : "批量创建失败",
      description: requestState.error,
    };
  }

  return null;
}

export function WorkspaceCreateCard({ settings, targetRecords = [], onBackfillApplied, presentation = "card", initialAuthStatus = null }: WorkspaceCreateCardProps) {
  const [open, setOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<GithubAuthStatus | null>(initialAuthStatus);
  const [requestState, setRequestState] = useState<RequestState>({ status: "idle" });
  const [form, setForm] = useState<CreateWorkspaceBatchInput>(() => buildInitialForm(settings, initialAuthStatus));
  const [repoNamesText, setRepoNamesText] = useState(() => buildRepoNamesText(buildInitialForm(settings, initialAuthStatus).repoNames));

  useEffect(() => {
    function handleGithubAuthStatusChanged(event: Event) {
      setAuthStatus((event as CustomEvent<GithubAuthStatus>).detail);
    }

    window.addEventListener(GITHUB_AUTH_STATUS_CHANGED_EVENT, handleGithubAuthStatusChanged);
    return () => {
      window.removeEventListener(GITHUB_AUTH_STATUS_CHANGED_EVENT, handleGithubAuthStatusChanged);
    };
  }, []);

  const resultText = useMemo(() => {
    if (requestState.status === "success") {
      return `成功 ${requestState.result.successCount} / 失败 ${requestState.result.failureCount}`;
    }
    if (requestState.status === "error") {
      return requestState.error;
    }
    if (requestState.status === "checking_auth") {
      return "正在检查 GitHub 权限";
    }
    if (requestState.status === "creating_repo") {
      return "正在批量创建 GitHub 仓库";
    }
    return undefined;
  }, [requestState]);

  const stepMeta = buildStepMeta(requestState, form);

  function updateField<Key extends keyof Omit<CreateWorkspaceBatchInput, "repoNames">>(key: Key, value: CreateWorkspaceBatchInput[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateRepoNames(value: string) {
    setRepoNamesText(value);
    setForm((current) => ({ ...current, repoNames: parseRepoNames(value) }));
  }

  function openModal() {
    const nextForm = { ...buildInitialForm(settings, authStatus), targetRecords };
    setRequestState({ status: "idle" });
    setForm(nextForm);
    setRepoNamesText(buildRepoNamesText(nextForm.repoNames));
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setRequestState({ status: "idle" });
  }

  function triggerGithubAuth() {
    closeModal();
    window.dispatchEvent(new Event(GITHUB_AUTH_START_EVENT));
  }

  async function ensureGithubAuthorized() {
    const response = await fetch("/api/github-auth/status", { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; data?: GithubAuthStatus };
    return response.ok && payload.ok && payload.data?.authorized;
  }

  async function submit() {
    const repoNames = parseRepoNames(repoNamesText);
    if (repoNames.length === 0) {
      setRequestState({ status: "error", step: "creating_repo", error: "请至少填写一个仓库名。" });
      return;
    }

    const payloadBody: CreateWorkspaceBatchInput = { ...form, repoNames, targetRecords };
    setForm(payloadBody);
    setRequestState({ status: "checking_auth" });
    const authorized = await ensureGithubAuthorized();

    if (!authorized) {
      setRequestState({ status: "error", step: "checking_auth", error: "请先完成 GitHub 授权，再创建仓库。" });
      return;
    }

    setRequestState({ status: "creating_repo" });
    const response = await fetch("/api/workspace-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string; code?: string; data?: WorkspaceProjectBatchResult };

    if (!response.ok || !payload.ok || !payload.data) {
      setRequestState({
        status: "error",
        step: "creating_repo",
        error: payload.code === "github_auth_required" ? "请先完成 GitHub 授权，再创建仓库。" : payload.error || "创建失败",
      });
      return;
    }

    setRequestState({ status: "success", result: payload.data });
    if (payload.data.backfillResults.some((item) => item.status === "updated")) {
      onBackfillApplied?.();
    }
  }

  return (
    <>
      {presentation === "card" ? (
        <ActionCard
          title="创建仓库"
          description="按设置批量创建 GitHub 仓库，支持 clone 到本地并逐个打开 Trae。"
          actionLabel="一键创建"
          onClick={openModal}
          pending={requestState.status === "checking_auth" || requestState.status === "creating_repo"}
          result={resultText}
          tone={requestState.status === "error" ? "error" : requestState.status === "success" ? "success" : "default"}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="w-fit rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={requestState.status === "checking_auth" || requestState.status === "creating_repo"}
            onClick={openModal}
            type="button"
          >
            {requestState.status === "checking_auth" || requestState.status === "creating_repo" ? "处理中" : "创建仓库"}
          </button>
          {resultText ? <div className={`text-xs ${requestState.status === "error" ? "text-red-600" : requestState.status === "success" ? "text-emerald-600" : "text-slate-500"}`}>{resultText}</div> : null}
        </div>
      )}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-950">创建仓库</h2>
              <p className="mt-1 text-sm text-slate-600">支持多行输入仓库名，每行一个，按共享配置并发创建。</p>
            </div>
            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div className="space-y-2 text-sm text-slate-700 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span>仓库名列表</span>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                    onClick={() => updateRepoNames(`${repoNamesText}${repoNamesText.trim() ? "\n" : ""}${buildDefaultRepoName()}`)}
                  >
                    新增随机仓库名
                  </button>
                </div>
                <textarea
                  className="min-h-36 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={repoNamesText}
                  onChange={(event) => updateRepoNames(event.currentTarget.value)}
                  placeholder={"solo-20260516-a\nsolo-20260516-b"}
                />
                <div className="text-xs text-slate-500">每行一个仓库名，空行会自动忽略。</div>
              </div>
              <label className="space-y-2 text-sm text-slate-700">
                <span>GitHub owner</span>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={form.githubOwner} onChange={(event) => updateField("githubOwner", event.currentTarget.value)} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>可见性</span>
                <select className="w-full rounded-lg border border-slate-200 px-3 py-2" value={form.visibility} onChange={(event) => updateField("visibility", event.currentTarget.value as CreateWorkspaceBatchInput["visibility"])}>
                  <option value="private">private</option>
                  <option value="public">public</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>本地目录</span>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={form.localRoot} onChange={(event) => updateField("localRoot", event.currentTarget.value)} />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Trae 应用名</span>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={form.traeAppName} onChange={(event) => updateField("traeAppName", event.currentTarget.value)} />
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.cloneEnabled} onChange={(event) => updateField("cloneEnabled", event.currentTarget.checked)} />
                <span>clone 到本地</span>
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.openTraeEnabled} onChange={(event) => updateField("openTraeEnabled", event.currentTarget.checked)} />
                <span>打开 Trae</span>
              </label>
            </div>
            {stepMeta ? (
              <div className="border-t border-slate-100 px-6 py-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={stepMeta.tone}>{stepMeta.badgeLabel}</StatusBadge>
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-950">{stepMeta.title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">{stepMeta.description}</div>
                  {requestState.status === "success" ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                          <div className="text-sm font-medium text-emerald-900">成功项目</div>
                          <div className="mt-2 space-y-2 text-sm text-emerald-950">
                            {requestState.result.projects.length > 0 ? (
                              requestState.result.projects.map((project) => (
                                <div key={project.workspaceId} className="rounded-lg bg-white/70 p-2">
                                  <div className="font-medium">{project.githubOwner}/{project.repoName}</div>
                                  <div className="break-all text-xs text-slate-600">{project.githubUrl}</div>
                                  <div className="break-all text-xs text-slate-600">{project.localPath}</div>
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-600">无成功项目</div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <div className="text-sm font-medium text-rose-900">失败项目</div>
                          <div className="mt-2 space-y-2 text-sm text-rose-950">
                            {requestState.result.failedItems.length > 0 ? (
                              requestState.result.failedItems.map((item) => (
                                <div key={`${item.repoName}-${item.error}`} className="rounded-lg bg-white/70 p-2">
                                  <div className="font-medium">{item.repoName}</div>
                                  <div className="text-xs text-slate-600">{item.error}</div>
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-600">无失败项目</div>
                            )}
                          </div>
                        </div>
                      </div>
                      {requestState.result.backfillResults.length > 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="text-sm font-medium text-slate-900">任务表回填结果</div>
                          <div className="mt-2 space-y-2 text-sm text-slate-700">
                            {requestState.result.backfillResults.map((item) => (
                              <div key={`${item.repoName}-${item.recordId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <div className="font-medium">{item.repoName} → {item.recordId}</div>
                                <div className="mt-1 text-xs text-slate-600">
                                  {item.status === "updated" ? "已回填" : item.status === "skipped" ? "已跳过" : "回填失败"}
                                  {item.githubUrl ? ` · ${item.githubUrl}` : ""}
                                  {item.branchOrFolder ? ` · ${item.branchOrFolder}` : ""}
                                </div>
                                {item.message ? <div className="mt-1 text-xs text-slate-500">{item.message}</div> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
              <button className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" onClick={closeModal}>
                {requestState.status === "success" ? "完成" : "取消"}
              </button>
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={requestState.status === "checking_auth" || requestState.status === "creating_repo" || requestState.status === "success"}
                onClick={requestState.status === "error" && requestState.step === "checking_auth" ? triggerGithubAuth : submit}
              >
                {requestState.status === "checking_auth"
                  ? "检查授权中"
                  : requestState.status === "creating_repo"
                    ? "批量创建中"
                    : requestState.status === "success"
                      ? "已完成"
                      : requestState.status === "error" && requestState.step === "checking_auth"
                        ? "一键授权"
                        : "确认创建"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
