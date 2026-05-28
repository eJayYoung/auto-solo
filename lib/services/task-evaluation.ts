import { DEFAULT_MODEL } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import { readWorkspaceRun } from "@/lib/services/workspace-runtime";
import type { WorkspaceRun, WorkspaceRunEvaluation } from "@/lib/types";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function normalizeApiUrl(baseUrl: string, apiPath: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildCandidateApiPaths(apiPath: string) {
  const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (normalizedPath.startsWith("/v1/")) {
    return [normalizedPath];
  }
  if (normalizedPath === "/chat/completions") {
    return [normalizedPath, `/v1${normalizedPath}`];
  }
  return [normalizedPath, `/v1${normalizedPath}`];
}

function parseEvaluation(content: string): WorkspaceRunEvaluation {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fencedMatch?.[1] ?? trimmed;
  const payload = JSON.parse(raw) as Partial<WorkspaceRunEvaluation>;
  const taskCompleted = payload.taskCompleted === "完成了任务" ? "完成了任务" : "未完成任务";
  const productSatisfaction = taskCompleted === "未完成任务" ? "不满意" : payload.productSatisfaction === "满意" ? "满意" : "不满意";
  const processSatisfaction = payload.processSatisfaction === "满意" ? "满意" : "不满意";
  const overallSatisfaction = productSatisfaction === "满意" && processSatisfaction === "满意" ? "满意" : "不满意";
  const productUnsatisfiedReason = typeof payload.productUnsatisfiedReason === "string" ? payload.productUnsatisfiedReason.trim() : "";
  const processUnsatisfiedReason = typeof payload.processUnsatisfiedReason === "string" ? payload.processUnsatisfiedReason.trim() : "";
  const combinedUnsatisfiedReason = overallSatisfaction === "满意" ? "" : `产物不满意：${productUnsatisfiedReason || "无"}\n过程不满意：${processUnsatisfiedReason || "无"}`;
  const evidence = Array.isArray(payload.evidence) ? payload.evidence.filter((item): item is string => typeof item === "string") : [];
  const confidence = payload.confidence === "high" || payload.confidence === "medium" || payload.confidence === "low" ? payload.confidence : "low";

  return {
    taskCompleted,
    productSatisfaction,
    processSatisfaction,
    overallSatisfaction,
    productUnsatisfiedReason: overallSatisfaction === "满意" ? "" : productUnsatisfiedReason,
    processUnsatisfiedReason: overallSatisfaction === "满意" ? "" : processUnsatisfiedReason,
    combinedUnsatisfiedReason,
    evidence,
    confidence,
  };
}

function buildPrompt(run: WorkspaceRun, taskRecord: {
  userPrompt: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  taskCompleted: string;
}) {
  return `请根据以下 Solo Coder 测试采集结果，判断任务是否完成、产物是否满意、过程是否满意，并在不满意时生成可直接作为标注草稿的原因。

要求：
- 只输出 JSON，不要输出 Markdown。
- JSON 格式：{"taskCompleted":"完成了任务|未完成任务","productSatisfaction":"满意|不满意","processSatisfaction":"满意|不满意","overallSatisfaction":"满意|不满意","productUnsatisfiedReason":"...","processUnsatisfiedReason":"...","combinedUnsatisfiedReason":"...","evidence":["..."],"confidence":"high|medium|low"}
- 如果任务未完成，productSatisfaction 必须为“不满意”。
- 如果 overallSatisfaction 为“不满意”，productUnsatisfiedReason 和 processUnsatisfiedReason 要分别评价本轮产物和过程，不要只写历史问题。
- 原因尽量包含范围/对象、现象证据、与需求偏差、影响、复现条件、严重程度中的至少两类信息。
- prompt 中没有提到的额外需求，不能作为判定未完成任务的依据。
- 如果日志、diff 或证据不足以判断，请给低置信度建议，并在 evidence 中说明缺失信息。

任务信息：
User Prompt: ${taskRecord.userPrompt}
任务类型: ${taskRecord.taskType}
业务领域: ${taskRecord.businessDomain}
修改范围: ${taskRecord.modifyScope}
任务是否完成: ${taskRecord.taskCompleted}

采集信息：
GitHub: ${run.githubUrl}
分支: ${run.branchName}
本地路径: ${run.localPath}
Git 状态:
${run.gitStatusText}
Git Diff:
${run.gitDiffText}
Diff 文件: ${run.diffFilePath}
截图路径: ${run.screenshotPath}
Trae 导出物: ${run.traeExportPath}
产物摘要: ${run.artifactSummary}
日志轨迹:
${run.logsText}`;
}

async function requestEvaluation(run: WorkspaceRun, taskRecord: {
  userPrompt: string;
  taskType: string;
  businessDomain: string;
  modifyScope: string;
  taskCompleted: string;
}): Promise<WorkspaceRunEvaluation> {
  const settings = await readUserSettings();
  const model = settings.model || DEFAULT_MODEL;

  if (!settings.modelKey.trim()) {
    throw new Error("请先在设置中填写 Model Key");
  }

  const apiPaths = buildCandidateApiPaths(settings.modelApiPath);
  let lastError: Error | null = null;

  for (const apiPath of apiPaths) {
    const url = normalizeApiUrl(settings.modelBaseUrl, apiPath);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.modelKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: "你是 Solo Coder 用户满意度标注质检助手。" },
            { role: "user", content: buildPrompt(run, taskRecord) },
          ],
        }),
        cache: "no-store",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastError = new Error(`模型接口网络请求失败。地址: ${url}；原因: ${reason}`);
      continue;
    }

    const rawText = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(rawText) as OpenAIChatResponse;
    } catch {
      const snippet = rawText.slice(0, 240).replace(/\s+/g, " ").trim();
      lastError = new Error(`模型接口返回非 JSON 响应。状态码: ${response.status}；响应片段: ${snippet}`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`模型接口请求失败（${response.status}）: ${payload.error?.message || rawText.slice(0, 240)}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("模型返回为空");
    }

    try {
      return parseEvaluation(content);
    } catch {
      throw new Error("模型返回非 JSON 或字段不完整");
    }
  }

  throw lastError ?? new Error("模型接口调用失败，请检查设置");
}

export async function analyzeWorkspaceRun(runId: string): Promise<WorkspaceRun> {
  const run = await readWorkspaceRun(runId);
  if (!run) {
    throw new Error(`Workspace run not found: ${runId}`);
  }

  const taskRecord = await prisma.taskRecord.findUnique({ where: { recordId: run.recordId } });
  if (!taskRecord) {
    throw new Error(`Task record not found: ${run.recordId}`);
  }

  const evaluation = await requestEvaluation(run, taskRecord);
  const updated = await prisma.workspaceRun.update({
    where: { runId },
    data: {
      status: "analyzed",
      suggestedTaskCompleted: evaluation.taskCompleted,
      aiSuggestedSatisfaction: evaluation.overallSatisfaction,
      aiSuggestedReason: evaluation.combinedUnsatisfiedReason,
      productUnsatisfiedReason: evaluation.productUnsatisfiedReason,
      processUnsatisfiedReason: evaluation.processUnsatisfiedReason,
      aiEvidence: JSON.stringify(evaluation.evidence),
      aiConfidence: evaluation.confidence,
    },
  });

  return {
    ...run,
    status: updated.status,
    suggestedTaskCompleted: updated.suggestedTaskCompleted,
    aiSuggestedSatisfaction: updated.aiSuggestedSatisfaction,
    aiSuggestedReason: updated.aiSuggestedReason,
    productUnsatisfiedReason: updated.productUnsatisfiedReason,
    processUnsatisfiedReason: updated.processUnsatisfiedReason,
    aiEvidence: evaluation.evidence,
    aiConfidence: updated.aiConfidence ?? undefined,
    updatedAt: updated.updatedAt.toISOString(),
  };
}
