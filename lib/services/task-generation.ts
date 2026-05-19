import { DEFAULT_MODEL, TASK_GENERATION_BASE_PROMPT } from "@/lib/constants";
import { checkTaskSimilarity } from "@/lib/services/dedupe";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import type { TaskItem } from "@/lib/types";

export type TaskGenerationInput = {
  count: number;
  model?: string;
  promptMode: "append" | "override";
  basePrompt?: string;
  userPrompt?: string;
  businessDomains?: string[];
  existingTasks: TaskItem[];
};

type GeneratedCandidate = {
  title: string;
  promptContent: string;
  taskType?: string;
  businessDomain?: string;
  modifyScope?: string;
};

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

function buildPrompt(input: TaskGenerationInput) {
  const historyHints = input.existingTasks
    .slice(0, 30)
    .map((task, index) => `${index + 1}. ${task.title || task.promptContent.slice(0, 40)}`)
    .join("\n");
  const dedupeHint = historyHints
    ? `\n\n去重要求：请避免与以下已存在题目主题重复（语义相近也算重复）：\n${historyHints}`
    : "";

  const domainHint = input.businessDomains?.length
    ? `\n\n业务领域要求：题目需限定在以下业务领域之一：${input.businessDomains.join("、")}。输出 JSON 中每个任务的 businessDomain 必须使用上述领域之一。`
    : "";

  const basePrompt = input.basePrompt?.trim() || TASK_GENERATION_BASE_PROMPT;

  if (!input.userPrompt?.trim()) {
    return `${basePrompt}${domainHint}${dedupeHint}`;
  }
  if (input.promptMode === "override") {
    return `${input.userPrompt.trim()}${domainHint}\n\n输出格式要求：仅输出 JSON 对象 {\"tasks\":[...]}。每个任务必须包含非空 title 和 promptContent。${dedupeHint}`;
  }
  return `${basePrompt}${domainHint}\n\n附加要求：${input.userPrompt.trim()}${dedupeHint}`;
}

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

function parseCandidates(content: string): GeneratedCandidate[] {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fencedMatch?.[1] ?? trimmed;
  const payload = JSON.parse(raw) as { tasks?: GeneratedCandidate[] } | GeneratedCandidate[];
  const tasks = Array.isArray(payload) ? payload : payload.tasks;
  if (!Array.isArray(tasks)) {
    throw new Error("模型返回格式错误：缺少 tasks 数组");
  }

  return tasks
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const candidate = item as Partial<GeneratedCandidate>;
      const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
      const promptContentRaw = typeof candidate.promptContent === "string" ? candidate.promptContent.trim() : "";
      const promptContent = promptContentRaw || title;
      return {
        title,
        promptContent,
        taskType: candidate.taskType?.trim(),
        businessDomain: candidate.businessDomain?.trim(),
        modifyScope: candidate.modifyScope?.trim(),
      };
    })
    .filter((item) => item.title && item.promptContent);
}

async function requestGeneratedCandidates(input: TaskGenerationInput): Promise<GeneratedCandidate[]> {
  const settings = await readUserSettings();
  const model = input.model || settings.model || DEFAULT_MODEL;

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
          temperature: 0.7,
          messages: [
            { role: "system", content: "你是资深软件工程出题助手。" },
            { role: "user", content: buildPrompt(input) },
          ],
        }),
        cache: "no-store",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lastError = new Error(`模型接口网络请求失败，请检查 MODEL_BASE_URL / MODEL_API_PATH 是否可访问。地址: ${url}；原因: ${reason}`);
      continue;
    }

    const rawText = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(rawText) as OpenAIChatResponse;
    } catch {
      const snippet = rawText.slice(0, 240).replace(/\s+/g, " ").trim();
      const looksLikeHtml = /<!doctype html>|<html/i.test(snippet);
      if (looksLikeHtml) {
        lastError = new Error(`模型接口返回 HTML 页面，可能命中了网关首页而非 API。当前地址: ${url}`);
        continue;
      }
      throw new Error(`模型接口返回非 JSON 响应（可能是网关/登录页）。状态码: ${response.status}；响应片段: ${snippet}`);
    }

    if (!response.ok) {
      const errorMessage = payload.error?.message || rawText.slice(0, 240);
      throw new Error(`模型接口请求失败（${response.status}）: ${errorMessage}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("模型返回为空");
    }

    try {
      return parseCandidates(content);
    } catch {
      throw new Error("模型返回非 JSON 或字段不完整");
    }
  }

  throw lastError ?? new Error("模型接口调用失败，请检查设置");
}

function toTaskItem(candidate: GeneratedCandidate, input: TaskGenerationInput, model: string, index: number): TaskItem {
  const fallbackBusinessDomain = input.businessDomains?.length === 1 ? input.businessDomains[0] : "待补充";

  return {
    taskId: `GENERATED-${Date.now()}-${index + 1}`,
    uidBinding: "",
    title: candidate.title,
    promptContent: candidate.promptContent,
    promptMode: input.promptMode,
    model,
    taskType: candidate.taskType || "功能开发",
    businessDomain: candidate.businessDomain || fallbackBusinessDomain,
    modifyScope: candidate.modifyScope || "多模块",
    sourceType: "generated",
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

export async function generateTasks(input: TaskGenerationInput): Promise<TaskItem[]> {
  const limitedCount = Math.min(Math.max(input.count, 1), 20);
  const settings = await readUserSettings();
  const model = input.model || settings.model || DEFAULT_MODEL;
  const accepted: TaskItem[] = [];
  const seen = new Set<string>(input.existingTasks.map((task) => task.promptContent.trim().toLowerCase()));
  let totalCandidates = 0;
  let duplicatedCount = 0;

  for (let attempt = 0; attempt < 3 && accepted.length < limitedCount; attempt += 1) {
    const candidates = await requestGeneratedCandidates({ ...input, count: limitedCount - accepted.length });
    totalCandidates += candidates.length;
    for (const candidate of candidates) {
      if (accepted.length >= limitedCount) {
        break;
      }
      const normalized = candidate.promptContent.trim().toLowerCase();
      const duplicatedAgainstHistory = checkTaskSimilarity(candidate.promptContent, input.existingTasks).duplicated;
      const duplicatedInBatch = seen.has(normalized);
      if (duplicatedAgainstHistory || duplicatedInBatch) {
        duplicatedCount += 1;
        continue;
      }
      seen.add(normalized);
      accepted.push(toTaskItem(candidate, input, model, accepted.length));
    }
  }

  if (accepted.length === 0) {
    if (totalCandidates === 0) {
      throw new Error("模型未返回题目，请调整提示词后重试");
    }
    if (duplicatedCount === totalCandidates) {
      throw new Error(`模型共返回 ${totalCandidates} 条，但与现有题库重复，请补充更具体约束后重试`);
    }
    throw new Error(`模型共返回 ${totalCandidates} 条，其中 ${duplicatedCount} 条重复，其余格式不完整，请调整提示词后重试`);
  }

  return accepted;
}
