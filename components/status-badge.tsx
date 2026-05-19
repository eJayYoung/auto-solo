const toneClassNames = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
};

type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: keyof typeof toneClassNames;
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClassNames[tone]}`}>{children}</span>;
}
