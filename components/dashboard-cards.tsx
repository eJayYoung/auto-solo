"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionCard } from "@/components/action-card";
import { GithubAuthCard } from "@/components/github-auth-card";
import { TaskBankActions } from "@/components/task-bank-actions";
import { WorkspaceCreateCard } from "@/components/workspace-create-card";
import { WorkspaceProjectsMetricCard } from "@/components/workspace-projects-metric-card";
import type { CreateWorkspaceTargetRecord, TaskItem, UserSettings } from "@/lib/types";

type MetricCardItem = {
  id: string;
  label: string;
  value: number;
};

type ActionCardItem =
  | {
      id: string;
      kind: "static";
      title: string;
      description: string;
      actionLabel: string;
    }
  | {
      id: string;
      kind: "github-auth";
    }
  | {
      id: string;
      kind: "workspace-create";
    };

type DashboardCardsProps = {
  metricCards: MetricCardItem[];
  actionCards: ActionCardItem[];
  initialSettings: UserSettings;
  initialMetricOrder: string[];
  initialActionOrder: string[];
  workspaceTargetRecords?: CreateWorkspaceTargetRecord[];
  onBackfillApplied?: () => void;
};


type SaveState =
  | { status: "idle" }
  | { status: "saving"; group: "metric" | "action" }
  | { status: "error"; message: string };

function reorderItems<T extends { id: string }>(items: T[], activeId: string, overId: string) {
  if (activeId === overId) {
    return items;
  }

  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);

  if (activeIndex === -1 || overIndex === -1) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(activeIndex, 1);
  nextItems.splice(overIndex, 0, movedItem);
  return nextItems;
}

function orderItems<T extends { id: string }>(items: T[], order: string[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return order.map((id) => itemMap.get(id)).filter((item): item is T => Boolean(item));
}

async function saveCardOrder(settings: UserSettings) {
  const response = await fetch("/api/user-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const payload = (await response.json()) as { ok?: boolean; error?: string; data?: UserSettings };

  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || "保存排序失败");
  }

  return payload.data;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function DraggableGridItem({
  id,
  draggingId,
  dragOverId,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  children,
}: {
  id: string;
  draggingId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDrop: (id: string) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}) {
  const isDragging = draggingId === id;
  const isDragOver = dragOverId === id && draggingId !== id;

  return (
    <div
      draggable
      className={`flex h-full cursor-grab transition ${isDragging ? "scale-[0.98] opacity-60" : "opacity-100"} ${isDragOver ? "rounded-2xl ring-2 ring-slate-300 ring-offset-2" : ""}`}
      onDragStart={() => onDragStart(id)}
      onDragEnter={() => onDragEnter(id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(id)}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full w-full">{children}</div>
    </div>
  );
}

export function DashboardCards({
  metricCards,
  actionCards,
  initialSettings,
  initialMetricOrder,
  initialActionOrder,
  workspaceTargetRecords = [],
  onBackfillApplied,
}: DashboardCardsProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [metricItems, setMetricItems] = useState(() => orderItems(metricCards, initialMetricOrder));
  const [actionItems, setActionItems] = useState(() => orderItems(actionCards, initialActionOrder));
  const [metricDraggingId, setMetricDraggingId] = useState<string | null>(null);
  const [metricDragOverId, setMetricDragOverId] = useState<string | null>(null);
  const [actionDraggingId, setActionDraggingId] = useState<string | null>(null);
  const [actionDragOverId, setActionDragOverId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [generateDialogOpenToken, setGenerateDialogOpenToken] = useState<number | undefined>(undefined);
  const [nextGenerateDialogOpenToken, setNextGenerateDialogOpenToken] = useState(1);

  async function persistMetricOrder(nextItems: MetricCardItem[]) {
    const nextSettings: UserSettings = {
      ...settings,
      dashboardMetricCardOrder: nextItems.map((item) => item.id),
    };

    setMetricItems(nextItems);
    setSettings(nextSettings);
    setSaveState({ status: "saving", group: "metric" });

    try {
      const savedSettings = await saveCardOrder(nextSettings);
      setSettings(savedSettings);
      setSaveState({ status: "idle" });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "保存排序失败" });
    }
  }

  async function persistActionOrder(nextItems: ActionCardItem[]) {
    const nextSettings: UserSettings = {
      ...settings,
      dashboardActionCardOrder: nextItems.map((item) => item.id),
    };

    setActionItems(nextItems);
    setSettings(nextSettings);
    setSaveState({ status: "saving", group: "action" });

    try {
      const savedSettings = await saveCardOrder(nextSettings);
      setSettings(savedSettings);
      setSaveState({ status: "idle" });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "保存排序失败" });
    }
  }

  function handleMetricDrop(dropId: string) {
    if (!metricDraggingId) {
      return;
    }

    const nextItems = reorderItems(metricItems, metricDraggingId, dropId);
    setMetricDraggingId(null);
    setMetricDragOverId(null);
    void persistMetricOrder(nextItems);
  }

  function handleMetricDragEnd() {
    setMetricDraggingId(null);
    setMetricDragOverId(null);
  }

  function handleActionDrop(dropId: string) {
    if (!actionDraggingId) {
      return;
    }

    const nextItems = reorderItems(actionItems, actionDraggingId, dropId);
    setActionDraggingId(null);
    setActionDragOverId(null);
    void persistActionOrder(nextItems);
  }

  function handleActionDragEnd() {
    setActionDraggingId(null);
    setActionDragOverId(null);
  }

  function handleStaticActionClick(actionId: string) {
    if (actionId === "generate-tasks") {
      setGenerateDialogOpenToken(nextGenerateDialogOpenToken);
      setNextGenerateDialogOpenToken((token) => token + 1);
      return;
    }

    if (actionId === "sync-feishu") {
      router.push("/tasks?action=sync-feishu");
    }
  }

  async function handleGeneratedInsert(items: TaskItem[]) {
    await fetch("/api/task-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  }

  return (
    <div className="space-y-8">
      <TaskBankActions model={settings.model} onConfirmInsert={handleGeneratedInsert} openToken={generateDialogOpenToken} onOpenTokenHandled={() => setGenerateDialogOpenToken(undefined)} hideTrigger />

      <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
        <div>拖拽卡片即可调整顺序，排序会自动保存。</div>
        <div>
          {saveState.status === "saving" ? "正在保存排序…" : saveState.status === "error" ? <span className="text-red-600">{saveState.message}</span> : null}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {metricItems.map((item) => (
          <DraggableGridItem
            key={item.id}
            id={item.id}
            draggingId={metricDraggingId}
            dragOverId={metricDragOverId}
            onDragStart={setMetricDraggingId}
            onDragEnter={setMetricDragOverId}
            onDrop={handleMetricDrop}
            onDragEnd={handleMetricDragEnd}
          >
            {item.id === "workspace-projects" ? <WorkspaceProjectsMetricCard /> : <MetricCard label={item.label} value={item.value} />}
          </DraggableGridItem>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {actionItems.map((item) => (
          <DraggableGridItem
            key={item.id}
            id={item.id}
            draggingId={actionDraggingId}
            dragOverId={actionDragOverId}
            onDragStart={setActionDraggingId}
            onDragEnter={setActionDragOverId}
            onDrop={handleActionDrop}
            onDragEnd={handleActionDragEnd}
          >
            {item.kind === "static" ? (
              <ActionCard
                title={item.title}
                description={item.description}
                actionLabel={item.actionLabel}
                onClick={() => handleStaticActionClick(item.id)}
              />
            ) : null}
            {item.kind === "github-auth" ? <GithubAuthCard /> : null}
            {item.kind === "workspace-create" ? <WorkspaceCreateCard settings={settings} targetRecords={workspaceTargetRecords} onBackfillApplied={onBackfillApplied} /> : null}
          </DraggableGridItem>
        ))}
      </section>
    </div>
  );
}
