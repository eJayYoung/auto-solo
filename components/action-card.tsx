type ActionCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  result?: string;
  tone?: "default" | "success" | "error";
};

export function ActionCard({
  title,
  description,
  actionLabel,
  onClick,
  disabled = false,
  pending = false,
  result,
  tone = "default",
}: ActionCardProps) {
  const resultClassName =
    tone === "error" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-500";

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 min-h-12 flex-1 text-sm leading-6 text-slate-600">{description}</p>
      <button
        className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onClick}
        disabled={disabled || pending}
        type="button"
      >
        {pending ? "处理中" : actionLabel}
      </button>
      {result ? <div className={`mt-3 text-xs ${resultClassName}`}>{result}</div> : null}
    </section>
  );
}
