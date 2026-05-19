import { TASK_RECORD_COLUMN_MAPPINGS } from "@/lib/task-record-columns";

export function TaskRecordColumnMapping() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">列映射</h2>
        <p className="mt-1 text-sm text-slate-600">飞书表格列与任务表字段一一对应。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">飞书表格列</th>
              <th className="px-5 py-3">任务表字段</th>
              <th className="px-5 py-3">任务表列名</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {TASK_RECORD_COLUMN_MAPPINGS.map((mapping) => (
              <tr key={`${mapping.feishuColumn}-${mapping.taskField}`}>
                <td className="px-5 py-3 font-medium text-slate-950">{mapping.feishuColumn}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-600">{mapping.taskField}</td>
                <td className="px-5 py-3 text-slate-700">
                  <span>{mapping.taskColumn}</span>
                  {mapping.editable ? (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">可编辑</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
