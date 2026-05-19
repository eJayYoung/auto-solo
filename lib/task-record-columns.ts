import type { TaskRecordColumnMapping } from "@/lib/types";

export const TASK_RECORD_COLUMN_MAPPINGS = [
  { feishuColumn: "UID", taskField: "uid", taskColumn: "UID" },
  { feishuColumn: "Trae Session ID", taskField: "traeSessionId", taskColumn: "Trae Session ID", editable: true },
  { feishuColumn: "轮次", taskField: "round", taskColumn: "轮次", editable: true },
  { feishuColumn: "User Prompt", taskField: "userPrompt", taskColumn: "User Prompt", editable: true },
  { feishuColumn: "任务类型", taskField: "taskType", taskColumn: "任务类型", editable: true },
  { feishuColumn: "业务领域", taskField: "businessDomain", taskColumn: "业务领域", editable: true },
  { feishuColumn: "修改范围", taskField: "modifyScope", taskColumn: "修改范围", editable: true },
  { feishuColumn: "任务是否完成", taskField: "taskCompleted", taskColumn: "任务是否完成", editable: true },
  { feishuColumn: "产物及过程是否满意", taskField: "processSatisfaction", taskColumn: "产物及过程是否满意", editable: true },
  { feishuColumn: "不满意原因", taskField: "unsatisfiedReason", taskColumn: "不满意原因", editable: true },
  { feishuColumn: "github地址", taskField: "githubUrl", taskColumn: "GitHub", editable: true },
  { feishuColumn: "分支/文件夹", taskField: "branchOrFolder", taskColumn: "分支/文件夹", editable: true },
  { feishuColumn: "截图", taskField: "screenshots", taskColumn: "截图", editable: true },
  { feishuColumn: "日志轨迹", taskField: "logs", taskColumn: "日志轨迹", editable: true },
  { feishuColumn: "状态", taskField: "qcStatus", taskColumn: "质检状态" },
  { feishuColumn: "质检时间/标注时间", taskField: "updatedAt", taskColumn: "更新时间" },
] satisfies TaskRecordColumnMapping[];

export const FEISHU_RECORD_FIELDS = TASK_RECORD_COLUMN_MAPPINGS.flatMap((mapping) =>
  mapping.feishuColumn.includes("/") ? mapping.feishuColumn.split("/") : mapping.feishuColumn
);
