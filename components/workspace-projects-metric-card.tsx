"use client";

import { useEffect, useState } from "react";

type WorkspaceProjectsState =
  | { status: "loading"; value: string }
  | { status: "unauthorized"; value: string }
  | { status: "success"; value: string };

export function WorkspaceProjectsMetricCard() {
  const [state, setState] = useState<WorkspaceProjectsState>({ status: "loading", value: "—" });

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      const response = await fetch("/api/workspace-projects", { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; data?: Array<unknown> };

      if (cancelled) {
        return;
      }

      if (response.status === 401) {
        setState({ status: "unauthorized", value: "—" });
        return;
      }

      if (response.ok && payload.ok && payload.data) {
        setState({ status: "success", value: String(payload.data.length) });
      }
    }

    void loadCount();

    return () => {
      cancelled = true;
    };
  }, []);

  return <MetricCard label="工作区项目" value={state.value} />;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}
