"use client";

import { useState } from "react";

export function CopyUrlButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100"
      onClick={() => {
        void handleCopy();
      }}
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}
