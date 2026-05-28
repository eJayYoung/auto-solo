"use client";

import { useState } from "react";
import type { SoloRound, SoloSession } from "@/lib/types";

const taskCompletedOptions = ["完成了任务", "未完成任务"];
const satisfactionOptions = ["满意", "不满意"];

function resolveSelectedRoundId(nextSession: SoloSession) {
  const rounds = nextSession.rounds ?? [];
  if (rounds.length === 0) {
    return "";
  }
  return rounds.find((round) => round.roundNumber === nextSession.currentRound)?.roundId ?? rounds.at(-1)?.roundId ?? "";
}

async function parseResponse<T>(response: Response) {
  const payload = (await response.json()) as { ok?: boolean; data?: T; error?: string };
  if (!response.ok || !payload.ok || payload.data == null) {
    throw new Error(payload.error || "请求失败");
  }
  return payload.data;
}

function buildCombinedReason(productReason: string, processReason: string) {
  if (!productReason.trim() && !processReason.trim()) {
    return "";
  }
  return `产物不满意：${productReason.trim() || "无"}\n过程不满意：${processReason.trim() || "无"}`;
}

function omitDraft(drafts: Record<string, SoloRound>, roundId: string) {
  const nextDrafts = { ...drafts };
  delete nextDrafts[roundId];
  return nextDrafts;
}

function buildRoundByNumber(rounds: SoloRound[]) {
  return new Map(rounds.map((round) => [round.roundNumber, round]));
}

function buildFeishuSubmitPreview(round?: SoloRound) {
  if (!round) {
    return "暂无可提交内容";
  }

  const rows = [
    ["Record ID", round.recordId],
    ["轮次", `第 ${round.roundNumber} 轮`],
    ["Trae Session ID", round.traeSessionId],
    ["User Prompt", round.userPrompt],
    ["任务类型", round.taskType],
    ["业务领域", round.businessDomain],
    ["修改范围", round.modifyScope],
    ["GitHub", round.githubUrl],
    ["分支/文件夹", round.branchOrFolder],
    ["日志轨迹", round.logsText],
    ["任务是否完成", round.taskCompleted],
    ["产物及过程是否满意", round.processSatisfaction],
    ["不满意原因", round.combinedUnsatisfiedReason],
  ];

  return rows.map(([label, value]) => `${label}: ${value?.trim() || "-"}`).join("\n\n");
}

export function SoloWorkbenchPageClient({ initialSession }: { initialSession: SoloSession }) {
  return (
    <div className="relative left-1/2 w-[calc(100vw-3rem)] max-w-[1900px] -translate-x-1/2">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px] 2xl:grid-cols-[340px_minmax(0,1fr)_420px]">
        <SoloStandaloneSidebar initialSession={initialSession} />
        <SoloSessionWorkbench initialSession={initialSession} />
      </div>
    </div>
  );
}

export function SoloSessionWorkbench({ initialSession, onSessionChange }: { initialSession: SoloSession; onSessionChange?: (session: SoloSession) => void }) {
  const [session, setSession] = useState(initialSession);
  const [selectedRoundId, setSelectedRoundId] = useState(initialSession.rounds?.[0]?.roundId ?? "");
  const [draftByRoundId, setDraftByRoundId] = useState<Record<string, SoloRound>>({});
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const rounds = session.rounds ?? [];
  const roundByNumber = buildRoundByNumber(rounds);
  const selectedRound = rounds.find((round) => round.roundId === selectedRoundId) ?? rounds.at(-1);
  const selectedDraft = selectedRound ? draftByRoundId[selectedRound.roundId] ?? selectedRound : undefined;
  const selectedRoundNumber = selectedDraft?.roundNumber ?? (session.currentRound || 1);
  const busy = Boolean(pendingAction);

  async function refreshSession() {
    const response = await fetch(`/api/solo-sessions/${session.sessionId}`, { cache: "no-store" });
    const nextSession = await parseResponse<SoloSession>(response);
    setSession(nextSession);
    onSessionChange?.(nextSession);
    setSelectedRoundId((current) => current || resolveSelectedRoundId(nextSession));
    return nextSession;
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setPendingAction(label);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失败");
    } finally {
      setPendingAction("");
    }
  }

  async function createInitialRound() {
    await runAction("创建首轮", async () => {
      const response = await fetch("/api/solo-rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const round = await parseResponse<SoloRound>(response);
      await refreshSession();
      setSelectedRoundId(round.roundId);
    });
  }

  async function generatePrompt(roundId: string) {
    await runAction("生成 Prompt", async () => {
      const response = await fetch("/api/solo-rounds/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      });
      const round = await parseResponse<SoloRound>(response);
      setDraftByRoundId((current) => omitDraft(current, round.roundId));
      await refreshSession();
      setSelectedRoundId(round.roundId);
    });
  }

  async function scoreRound(roundId: string) {
    await runAction("一键评分", async () => {
      const response = await fetch("/api/solo-rounds/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      });
      const round = await parseResponse<SoloRound>(response);
      setDraftByRoundId((current) => omitDraft(current, round.roundId));
      await refreshSession();
      setSelectedRoundId(round.roundId);
    });
  }

  async function saveRound(round: SoloRound) {
    await runAction("保存轮次", async () => {
      const response = await fetch("/api/solo-rounds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(round),
      });
      const updated = await parseResponse<SoloRound>(response);
      setDraftByRoundId((current) => omitDraft(current, updated.roundId));
      await refreshSession();
      setSelectedRoundId(updated.roundId);
    });
  }

  async function createNextRound(roundId: string) {
    await runAction("创建下一轮", async () => {
      const response = await fetch("/api/solo-rounds/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      });
      const round = await parseResponse<SoloRound>(response);
      await refreshSession();
      setSelectedRoundId(round.roundId);
    });
  }

  async function deleteRound(roundId: string) {
    const confirmed = window.confirm("确认删除该轮次吗？仅删除本地轮次，不会删除已同步飞书的数据。此操作不可恢复。");
    if (!confirmed) {
      return;
    }

    await runAction("删除轮次", async () => {
      const response = await fetch("/api/solo-rounds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, roundId }),
      });
      const nextSession = await parseResponse<SoloSession>(response);
      setDraftByRoundId((current) => omitDraft(current, roundId));
      setSession(nextSession);
      onSessionChange?.(nextSession);
      setSelectedRoundId(resolveSelectedRoundId(nextSession));
    });
  }

  async function runRepoAction(label: string, action: "clone" | "open_trae") {
    await runAction(label, async () => {
      const response = await fetch(`/api/solo-sessions/${session.sessionId}/repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const nextSession = await parseResponse<SoloSession>(response);
      setSession(nextSession);
      onSessionChange?.(nextSession);
    });
  }

  async function submitRoundToFeishu(roundId: string) {
    await runAction("同步飞书", async () => {
      const response = await fetch("/api/solo-rounds/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      });
      const [round] = await parseResponse<SoloRound[]>(response);
      if (round) {
        setDraftByRoundId((current) => omitDraft(current, round.roundId));
        setSelectedRoundId(round.roundId);
      }
      await refreshSession();
    });
  }

  return (
    <div className="contents">
      <main className="min-w-0 space-y-4">
        {(pendingAction || error) ? (
          <div className={`rounded-2xl border p-3 text-sm shadow-sm ${error ? "border-red-100 bg-red-50 text-red-700" : "border-blue-100 bg-blue-50 text-blue-700"}`}>
            {error || `${pendingAction}中...`}
          </div>
        ) : null}

        <SoloTaskWorkspace
            busy={busy}
            canCreateNext={rounds.length < session.maxRounds && Boolean(selectedDraft)}
            draft={selectedDraft}
            onChange={(nextRound) => setDraftByRoundId((current) => ({ ...current, [nextRound.roundId]: nextRound }))}
            onClone={() => runRepoAction("Clone 到本地", "clone")}
            onCreateInitialRound={createInitialRound}
            onCreateNext={() => selectedDraft ? createNextRound(selectedDraft.roundId) : undefined}
            onDelete={() => selectedDraft ? deleteRound(selectedDraft.roundId) : undefined}
            onGeneratePrompt={() => selectedDraft ? generatePrompt(selectedDraft.roundId) : undefined}
            onOpenTrae={() => runRepoAction("用 Trae 打开", "open_trae")}
            onSave={saveRound}
            onScore={() => selectedDraft ? scoreRound(selectedDraft.roundId) : undefined}
            onSelectRound={(roundNumber) => {
              const round = roundByNumber.get(roundNumber);
              if (round) {
                setSelectedRoundId(round.roundId);
              }
            }}
            roundByNumber={roundByNumber}
            selectedRoundNumber={selectedRoundNumber}
            session={session}
        />
      </main>

      <FeishuSubmitPanel
        busy={busy}
        onSubmit={() => selectedDraft ? submitRoundToFeishu(selectedDraft.roundId) : undefined}
        round={selectedDraft}
      />
    </div>
  );
}

function SoloStandaloneSidebar({ initialSession }: { initialSession: SoloSession }) {
  return <SoloTaskSidebar busy={false} onCreateInitialRound={() => undefined} onSelectTask={() => undefined} selectedTaskId={initialSession.sessionId} session={initialSession} />;
}

function SoloTaskSidebar({ session, selectedTaskId, busy, onSelectTask, onCreateInitialRound }: { session: SoloSession; selectedTaskId: string; busy: boolean; onSelectTask: (taskId: string) => void; onCreateInitialRound: () => void }) {
  const rounds = session.rounds ?? [];
  const scoredCount = rounds.filter((round) => round.scoreStatus === "scored").length;
  const submittedCount = rounds.filter((round) => round.importStatus === "imported").length;
  const active = selectedTaskId === session.sessionId;

  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-base font-semibold text-slate-950">Solo Coder 工作台</h1>
        <p className="mt-1 text-xs text-slate-500">左侧选择任务，中间处理轮次，右侧提交飞书。</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">任务列表</h2>
          <StatusPill tone={session.repoCloned ? "success" : "neutral"}>{session.repoCloned ? "已 clone" : "未 clone"}</StatusPill>
        </div>
        <button className={`mt-3 w-full rounded-xl border p-3 text-left text-sm transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`} onClick={() => onSelectTask(session.sessionId)} type="button">
          <div className="font-semibold">{session.repoName}</div>
          <div className="mt-1 break-all text-xs opacity-80">{session.githubUrl}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <TaskStat label="轮次" value={`${rounds.length}/${session.maxRounds}`} active={active} />
            <TaskStat label="评分" value={`${scoredCount}/${rounds.length || session.maxRounds}`} active={active} />
            <TaskStat label="飞书" value={`${submittedCount}/${rounds.length || session.maxRounds}`} active={active} />
            <TaskStat label="状态" value={session.status} active={active} />
          </div>
          {session.businessDomain ? <div className="mt-3 line-clamp-2 text-xs opacity-75">{session.businessDomain}</div> : null}
        </button>
        {rounds.length === 0 ? (
          <button className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={onCreateInitialRound} type="button">
            创建首轮
          </button>
        ) : null}
      </section>
    </aside>
  );
}

function TaskStat({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${active ? "bg-white/10" : "bg-slate-50"}`}>
      <div className="opacity-70">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function SoloTaskWorkspace({ session, draft, roundByNumber, selectedRoundNumber, busy, canCreateNext, onSelectRound, onChange, onGeneratePrompt, onSave, onClone, onOpenTrae, onScore, onCreateNext, onDelete, onCreateInitialRound }: { session: SoloSession; draft?: SoloRound; roundByNumber: Map<number, SoloRound>; selectedRoundNumber: number; busy: boolean; canCreateNext: boolean; onSelectRound: (roundNumber: number) => void; onChange: (round: SoloRound) => void; onGeneratePrompt: () => void; onSave: (round: SoloRound) => void; onClone: () => void; onOpenTrae: () => void; onScore: () => void; onCreateNext: () => void; onDelete: () => void; onCreateInitialRound: () => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{session.repoName}</h2>
          <p className="mt-1 text-sm text-slate-500">{session.businessDomain || "未填写业务领域"}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <StatusPill tone={session.repoCloned ? "success" : "neutral"}>{session.repoCloned ? "仓库已 Clone" : "仓库未 Clone"}</StatusPill>
          <StatusPill>{session.currentRound} / {session.maxRounds}</StatusPill>
        </div>
      </div>

      <RoundTabs currentRoundNumber={selectedRoundNumber} maxRounds={session.maxRounds} onSelectRound={onSelectRound} roundByNumber={roundByNumber} />

      {draft ? (
        <div className="mt-5 space-y-5">
          <RoundActionBar
            busy={busy}
            canCreateNext={canCreateNext}
            draft={draft}
            onClone={onClone}
            onCreateNext={onCreateNext}
            onDelete={onDelete}
            onGeneratePrompt={onGeneratePrompt}
            onOpenTrae={onOpenTrae}
            onSave={() => onSave(draft)}
            onScore={onScore}
            repoCloned={Boolean(session.repoCloned)}
          />
          <WorkflowSteps round={draft} />
          <SoloRoundForm draft={draft} onChange={onChange} />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <h3 className="text-base font-semibold text-slate-950">还没有轮次</h3>
          <p className="mt-2 text-sm text-slate-500">创建首轮后即可生成 Prompt、执行和评分。</p>
          <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={onCreateInitialRound} type="button">
            创建首轮
          </button>
        </div>
      )}
    </section>
  );
}

function RoundTabs({ roundByNumber, currentRoundNumber, maxRounds, onSelectRound }: { roundByNumber: Map<number, SoloRound>; currentRoundNumber: number; maxRounds: number; onSelectRound: (roundNumber: number) => void }) {
  return (
    <div className="mt-5 grid gap-2 md:grid-cols-5">
      {Array.from({ length: maxRounds }, (_, index) => index + 1).map((roundNumber) => {
        const round = roundByNumber.get(roundNumber);
        const active = roundNumber === currentRoundNumber;
        return (
          <button
            key={roundNumber}
            className={`rounded-xl border p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            disabled={!round}
            onClick={() => onSelectRound(roundNumber)}
            type="button"
          >
            <div className="font-medium">第 {roundNumber} 轮</div>
            <div className="mt-1 truncate text-xs opacity-80">{round ? `${round.taskType || "待填写"} · ${round.scoreStatus}` : "未创建"}</div>
          </button>
        );
      })}
    </div>
  );
}

function RoundActionBar({ draft, busy, repoCloned, canCreateNext, onGeneratePrompt, onSave, onClone, onOpenTrae, onScore, onCreateNext, onDelete }: { draft: SoloRound; busy: boolean; repoCloned: boolean; canCreateNext: boolean; onGeneratePrompt: () => void; onSave: () => void; onClone: () => void; onOpenTrae: () => void; onScore: () => void; onCreateNext: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">第 {draft.roundNumber} 轮操作面板</h3>
          <p className="mt-1 text-xs text-slate-500">Prompt、仓库、Trae、评分和下一轮操作都在这里完成。</p>
        </div>
        <StatusPill tone={draft.scoreStatus === "scored" ? "success" : draft.scoreStatus === "failed" ? "danger" : "neutral"}>{draft.scoreStatus}</StatusPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={busy} onClick={onGeneratePrompt} type="button">生成 Prompt</button>
        <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={onSave} type="button">保存本地</button>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={busy || repoCloned} onClick={onClone} type="button">{repoCloned ? "已 Clone" : "Clone 仓库"}</button>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={busy || !repoCloned} onClick={onOpenTrae} type="button">用 Trae 打开</button>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={busy || !draft.userPrompt.trim()} onClick={onScore} type="button">AI 评分</button>
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50" disabled={busy || !canCreateNext} onClick={onCreateNext} type="button">创建下一轮</button>
        <button className="rounded-lg border border-red-100 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={busy} onClick={onDelete} type="button">删除当前轮</button>
      </div>
    </div>
  );
}

function SoloRoundForm({ draft, onChange }: { draft: SoloRound; onChange: (round: SoloRound) => void }) {
  function updateField<Key extends keyof SoloRound>(key: Key, value: SoloRound[Key]) {
    const next = { ...draft, [key]: value };
    if (key === "productUnsatisfiedReason" || key === "processUnsatisfiedReason") {
      next.combinedUnsatisfiedReason = buildCombinedReason(String(next.productUnsatisfiedReason), String(next.processUnsatisfiedReason));
    }
    onChange(next);
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Record ID"><input className="form-input" placeholder="从飞书任务表复制 Record ID" value={draft.recordId} onChange={(event) => updateField("recordId", event.currentTarget.value)} /></Field>
        <Field label="Trae Session ID"><input className="form-input" placeholder="填写 Trae Solo Coder 会话 ID" value={draft.traeSessionId} onChange={(event) => updateField("traeSessionId", event.currentTarget.value)} /></Field>
        <Field label="任务类型"><input className="form-input" placeholder="例如：0-1代码生成 / Bug修复 / Feature迭代" value={draft.taskType} onChange={(event) => updateField("taskType", event.currentTarget.value)} /></Field>
        <Field label="业务领域"><input className="form-input" placeholder="例如：零售门店设备巡检与维修" value={draft.businessDomain} onChange={(event) => updateField("businessDomain", event.currentTarget.value)} /></Field>
        <Field label="修改范围"><input className="form-input" placeholder="概括本轮代码修改范围" value={draft.modifyScope} onChange={(event) => updateField("modifyScope", event.currentTarget.value)} /></Field>
        <Field label="任务是否完成"><select className="form-input" value={draft.taskCompleted} onChange={(event) => updateField("taskCompleted", event.currentTarget.value)}><option value="">请选择任务完成状态</option>{taskCompletedOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
        <Field label="产物及过程是否满意"><select className="form-input" value={draft.processSatisfaction} onChange={(event) => updateField("processSatisfaction", event.currentTarget.value)}><option value="">请选择满意度</option>{satisfactionOptions.map((option) => <option key={option}>{option}</option>)}</select></Field>
        <Field label="GitHub"><input className="form-input" placeholder="https://github.com/owner/repo" value={draft.githubUrl} onChange={(event) => updateField("githubUrl", event.currentTarget.value)} /></Field>
        <Field label="分支/文件夹"><input className="form-input" placeholder="例如：main" value={draft.branchOrFolder} onChange={(event) => updateField("branchOrFolder", event.currentTarget.value)} /></Field>
        <Field label="Diff 文件"><input className="form-input" placeholder="workspace/<repo>/diff/round-n.diff" value={draft.diffFilePath} onChange={(event) => updateField("diffFilePath", event.currentTarget.value)} /></Field>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field className="lg:col-span-2" label="User Prompt"><textarea className="form-textarea min-h-64" placeholder="复制或编辑本轮要给 Solo Coder 的完整 Prompt" value={draft.userPrompt} onChange={(event) => updateField("userPrompt", event.currentTarget.value)} /></Field>
        <Field label="产物不满意原因"><textarea className="form-textarea min-h-32" placeholder="如果产物不满意，填写具体原因；满意可留空" value={draft.productUnsatisfiedReason} onChange={(event) => updateField("productUnsatisfiedReason", event.currentTarget.value)} /></Field>
        <Field label="过程不满意原因"><textarea className="form-textarea min-h-32" placeholder="如果过程不满意，填写具体原因；满意可留空" value={draft.processUnsatisfiedReason} onChange={(event) => updateField("processUnsatisfiedReason", event.currentTarget.value)} /></Field>
        <Field className="lg:col-span-2" label="合并后的不满意原因"><textarea className="form-textarea min-h-28" placeholder="会根据上面两个原因自动合并，也可以手动调整" value={draft.combinedUnsatisfiedReason} onChange={(event) => updateField("combinedUnsatisfiedReason", event.currentTarget.value)} /></Field>
        <Field className="lg:col-span-2" label="日志轨迹"><textarea className="form-textarea min-h-40" placeholder="粘贴 Trae / Solo Coder 执行日志" value={draft.logsText} onChange={(event) => updateField("logsText", event.currentTarget.value)} /></Field>
        <Field label="Git Status"><textarea className="form-textarea min-h-32" placeholder="粘贴 git status 输出" value={draft.gitStatusText} onChange={(event) => updateField("gitStatusText", event.currentTarget.value)} /></Field>
        <Field label="Git Diff"><textarea className="form-textarea min-h-32" placeholder="粘贴或确认本轮 git diff 摘要" value={draft.gitDiffText} onChange={(event) => updateField("gitDiffText", event.currentTarget.value)} /></Field>
      </div>
    </>
  );
}

function WorkflowSteps({ round }: { round: SoloRound }) {
  const steps = [
    { label: "准备任务", done: Boolean(round.taskType || round.businessDomain || round.modifyScope) },
    { label: "生成 Prompt", done: Boolean(round.userPrompt.trim()) },
    { label: "Trae 执行", done: Boolean(round.traeSessionId.trim() || round.logsText.trim()) },
    { label: "评分验收", done: round.scoreStatus === "scored" },
    { label: "交付记录", done: Boolean(round.githubUrl.trim() && round.diffFilePath.trim()) },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step.label} className={`rounded-xl border px-3 py-2 text-sm ${step.done ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
          <div className="text-xs opacity-70">{index + 1}</div>
          <div className="font-medium">{step.label}</div>
        </div>
      ))}
    </div>
  );
}

function FeishuSubmitPanel({ round, busy, onSubmit }: { round?: SoloRound; busy: boolean; onSubmit: () => void }) {
  const previewText = buildFeishuSubmitPreview(round);

  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">提交到飞书</h2>
            <p className="mt-1 text-xs text-slate-500">这里展示当前轮将写入飞书表格的字段。</p>
          </div>
          <StatusPill tone={round?.importStatus === "imported" ? "success" : round?.importStatus === "failed" ? "danger" : "neutral"}>{round?.importStatus ?? "no round"}</StatusPill>
        </div>
        <div className="mt-4 grid gap-2">
          <button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !round?.recordId.trim()} onClick={onSubmit} type="button">同步到飞书</button>
          <CopyButton className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" value={previewText}>复制提交内容</CopyButton>
        </div>
        {round?.importError ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{round.importError}</p> : null}
        {round?.submittedAt ? <p className="mt-3 text-xs text-slate-500">上次同步：{round.submittedAt}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">飞书字段</h3>
        <div className="mt-3 space-y-3">
          <CopyableMirrorItem label="Record ID" value={round?.recordId} />
          <CopyableMirrorItem label="轮次" value={round ? `第 ${round.roundNumber} 轮` : ""} />
          <CopyableMirrorItem label="Trae Session ID" value={round?.traeSessionId} />
          <CopyableMirrorItem label="任务类型" value={round?.taskType} />
          <CopyableMirrorItem label="业务领域" value={round?.businessDomain} />
          <CopyableMirrorItem label="修改范围" value={round?.modifyScope} />
          <CopyableMirrorItem label="GitHub" value={round?.githubUrl} />
          <CopyableMirrorItem label="分支/文件夹" value={round?.branchOrFolder} />
          <CopyableMirrorItem label="任务是否完成" value={round?.taskCompleted} />
          <CopyableMirrorItem label="产物及过程是否满意" value={round?.processSatisfaction} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">User Prompt</h3>
          <CopyButton value={round?.userPrompt} />
        </div>
        <MirrorBlock value={round?.userPrompt} empty="暂无 Prompt" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">不满意原因</h3>
          <CopyButton value={round?.combinedUnsatisfiedReason} />
        </div>
        <MirrorBlock value={round?.combinedUnsatisfiedReason} empty="暂无不满意原因" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">日志轨迹</h3>
          <CopyButton value={round?.logsText} />
        </div>
        <MirrorBlock value={round?.logsText} empty="暂无日志" />
      </section>
    </aside>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "danger" }) {
  const className = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "danger" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

function MirrorItem({ label, value, action }: { label: string; value?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        {action}
      </div>
      <div className="mt-2 break-all text-sm font-medium text-slate-900">{value?.trim() || "-"}</div>
    </div>
  );
}

function CopyableMirrorItem({ label, value }: { label: string; value?: string }) {
  return <MirrorItem action={<CopyButton value={value} />} label={label} value={value} />;
}

function CopyButton({ value, children = "复制", className = "rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40" }: { value?: string; children?: React.ReactNode; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copyValue() {
    if (!value?.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 1200);
    }
  }

  return (
    <button className={className} disabled={!value?.trim()} onClick={copyValue} type="button">
      {state === "copied" ? "已复制" : state === "error" ? "失败" : children}
    </button>
  );
}

function MirrorBlock({ value, empty }: { value?: string; empty: string }) {
  return <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">{value?.trim() || empty}</pre>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-2 text-sm text-slate-700 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
