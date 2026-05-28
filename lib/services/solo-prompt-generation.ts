import { DEFAULT_MODEL, SOLO_CODER_PROMPT_RULES } from "@/lib/constants";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import type { SoloPromptResult, SoloRound, SoloSession } from "@/lib/types";

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
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

function parsePromptResult(content: string): SoloPromptResult {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fencedMatch?.[1] ?? trimmed;
  const payload = JSON.parse(raw) as Partial<SoloPromptResult>;

  return {
    userPrompt: typeof payload.userPrompt === "string" ? payload.userPrompt.trim() : "",
    taskType: typeof payload.taskType === "string" ? payload.taskType.trim() : "",
    businessDomain: typeof payload.businessDomain === "string" ? payload.businessDomain.trim() : "",
    modifyScope: typeof payload.modifyScope === "string" ? payload.modifyScope.trim() : "",
  };
}

function buildInitialPrompt(session: SoloSession) {
  return `${SOLO_CODER_PROMPT_RULES}

请为仓库 ${session.repoName} 生成第 1 轮 Solo Coder Prompt。
要求：任务类型固定为“0-1代码生成”，不要生成单文件题目，交付物应适合在 Trae 中从空仓库实现。
只输出 JSON：{"userPrompt":"...","taskType":"0-1代码生成","businessDomain":"...","modifyScope":"..."}`;
}

function buildFeaturePrompt(session: SoloSession, rounds: SoloRound[]) {
  return `${SOLO_CODER_PROMPT_RULES}

仓库：${session.repoName}
历史轮次：
${rounds.map((round) => `第 ${round.roundNumber} 轮：${round.userPrompt}\n完成度：${round.taskCompleted}\n满意度：${round.processSatisfaction}`).join("\n\n")}

上一轮已满意，请生成下一轮 Feature 迭代 Prompt。只能围绕首轮和已有产物做平滑扩展，不要切换无关需求。
只输出 JSON：{"userPrompt":"...","taskType":"Feature迭代","businessDomain":"...","modifyScope":"..."}`;
}

function buildBugFixPrompt(session: SoloSession, rounds: SoloRound[]) {
  const lastRound = rounds.at(-1);
  return `${SOLO_CODER_PROMPT_RULES}

仓库：${session.repoName}
历史轮次：
${rounds.map((round) => `第 ${round.roundNumber} 轮：${round.userPrompt}\n产物不满意：${round.productUnsatisfiedReason}\n过程不满意：${round.processUnsatisfiedReason}\nDiff摘要：${round.gitStatusText}`).join("\n\n")}

上一轮不满意，请生成下一轮 Bug 修复 Prompt，聚焦修复上一轮明确问题。
上一轮合并原因：${lastRound?.combinedUnsatisfiedReason ?? ""}
只输出 JSON：{"userPrompt":"...","taskType":"Bug修复","businessDomain":"...","modifyScope":"..."}`;
}

async function requestPrompt(userPrompt: string): Promise<SoloPromptResult> {
  const settings = await readUserSettings();
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
          model: settings.model || DEFAULT_MODEL,
          temperature: 0.4,
          messages: [
            { role: "system", content: "你是 Solo Coder 标注任务提示词生成助手，只输出 JSON。" },
            { role: "user", content: userPrompt },
          ],
        }),
        cache: "no-store",
      });
    } catch (error) {
      lastError = new Error(error instanceof Error ? error.message : String(error));
      continue;
    }

    const rawText = await response.text();
    let payload: OpenAIChatResponse;
    try {
      payload = JSON.parse(rawText) as OpenAIChatResponse;
    } catch {
      lastError = new Error(`模型接口返回非 JSON 响应：${rawText.slice(0, 160)}`);
      continue;
    }

    if (!response.ok) {
      throw new Error(`模型接口请求失败（${response.status}）: ${payload.error?.message || rawText.slice(0, 240)}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("模型返回为空");
    }

    return parsePromptResult(content);
  }

  throw lastError ?? new Error("模型接口调用失败，请检查设置");
}

export function buildFallbackPromptResult(taskType: "0-1代码生成" | "Feature迭代" | "Bug修复", repoName: string): SoloPromptResult {
  return {
    userPrompt: taskType === "0-1代码生成"
      ? `请基于当前空仓库实现一个本地可运行的轻量 Solo Coder 交互式工作台，围绕真实业务场景提供 3-5 个核心交互能力，并提供清晰的页面验收方式。`
      : taskType === "Feature迭代"
        ? `请在 ${repoName} 已有功能基础上做一次平滑 Feature 迭代，新增一个与当前主流程相关的交互能力，并确保原有核心流程不回退。`
        : `请修复 ${repoName} 上一轮执行中暴露的明确问题，优先处理阻塞主流程的缺陷，并说明如何验证修复结果。`,
    taskType,
    businessDomain: "全栈 Web 应用",
    modifyScope: taskType === "0-1代码生成" ? "跨模块多文件" : "模块内多文件",
  };
}

export async function generateInitialSoloPrompt(session: SoloSession) {
  return requestPrompt(buildInitialPrompt(session));
}

export async function generateFeatureIterationPrompt(session: SoloSession, rounds: SoloRound[]) {
  return requestPrompt(buildFeaturePrompt(session, rounds));
}

export async function generateBugFixPrompt(session: SoloSession, rounds: SoloRound[]) {
  return requestPrompt(buildBugFixPrompt(session, rounds));
}
