type TableShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function TableShell({ title, description, children }: TableShellProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
