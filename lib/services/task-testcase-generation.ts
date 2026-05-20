import { DEFAULT_MODEL } from "@/lib/constants";
import { readUserSettings } from "@/lib/services/local-user-settings-store";
import type { TaskItem, TaskTestCase, TaskTestCaseSet, TaskTestCaseType } from "@/lib/types";

type TaskTestCaseGenerationOptions = {
  model?: string;
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

const TEST_CASE_TYPES: TaskTestCaseType[] = ["normal", "edge", "error", "regression"];
const SEVERITIES: TaskTestCase["severity"][] = ["must", "should", "nice"];

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

function buildPrompt(task: TaskItem) {
  return `请为下面这道 Solo Coder 评测题目生成便于人工检查的测试用例/验收检查点。

题目标题：${task.title}
任务类型：${task.taskType || "待补充"}
业务领域：${task.businessDomain || "待补充"}
修改范围：${task.modifyScope || "待补充"}
题目内容：
${task.promptContent}

要求：
1. 生成 3-6 条测试用例，至少包含 1 条边界或异常用例。
2. 用例必须围绕题目明确要求，不要增加题目没有提到的隐形需求。
3. 每条用例要帮助用户检查任务是否完成、核心流程是否可用、产物是否符合题目意图。
4. testData 必须给出可直接准备的测试数据、账号、配置、初始记录或 Mock 数据；如果题目不依赖数据，也要写明“无需额外测试数据”。
5. checkpoints 要具体可观察，避免“功能正常”这种笼统表达。
6. 仅输出 JSON 对象，不要输出 Markdown 或解释文本。

JSON 结构必须为：
{
  "summary": "这组用例的检查目标",
  "testCases": [
    {
      "name": "用例名称",
      "type": "normal|edge|error|regression",
      "preconditions": ["环境、权限、页面入口等前置条件"],
      "testData": ["可直接准备的测试数据/账号/配置/Mock 数据"],
      "input": "输入数据或操作入口",
      "steps": ["操作步骤"],
      "expected": "预期结果",
      "checkpoints": ["可观察检查点"],
      "severity": "must|should|nice"
    }
  ],
  "notes": "补充说明，没有则为空字符串"
}`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeTestCase(value: unknown): TaskTestCase | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Record<keyof TaskTestCase, unknown>>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const type = typeof candidate.type === "string" && TEST_CASE_TYPES.includes(candidate.type as TaskTestCaseType) ? (candidate.type as TaskTestCaseType) : "normal";
  const input = typeof candidate.input === "string" ? candidate.input.trim() : "";
  const expected = typeof candidate.expected === "string" ? candidate.expected.trim() : "";
  const severity = typeof candidate.severity === "string" && SEVERITIES.includes(candidate.severity as TaskTestCase["severity"]) ? (candidate.severity as TaskTestCase["severity"]) : "must";
  const preconditions = normalizeStringArray(candidate.preconditions);
  const testData = normalizeStringArray(candidate.testData);
  const steps = normalizeStringArray(candidate.steps);
  const checkpoints = normalizeStringArray(candidate.checkpoints);

  if (!name || !expected || steps.length === 0 || checkpoints.length === 0) {
    return null;
  }

  return {
    name,
    type,
    preconditions,
    testData: testData.length > 0 ? testData : ["无需额外测试数据"],
    input,
    steps,
    expected,
    checkpoints,
    severity,
  };
}

function parseTestCaseSet(content: string): TaskTestCaseSet {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fencedMatch?.[1] ?? trimmed;
  const payload = JSON.parse(raw) as Partial<TaskTestCaseSet>;
  const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const testCases = Array.isArray(payload.testCases) ? payload.testCases.map(normalizeTestCase).filter((item): item is TaskTestCase => item !== null) : [];

  if (!summary || testCases.length === 0) {
    throw new Error("模型返回格式错误：缺少 summary 或 testCases");
  }

  return { summary, testCases, notes };
}

export async function generateTaskTestCases(task: TaskItem, options: TaskTestCaseGenerationOptions = {}): Promise<TaskTestCaseSet> {
  const settings = await readUserSettings();
  const model = options.model || settings.model || DEFAULT_MODEL;

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
          temperature: 0.3,
          messages: [
            { role: "system", content: "你是资深软件测试与代码评测专家，擅长把开发题目拆成可人工验收的测试用例。" },
            { role: "user", content: buildPrompt(task) },
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
      return parseTestCaseSet(content);
    } catch {
      throw new Error("模型返回非 JSON 或字段不完整");
    }
  }

  throw lastError ?? new Error("模型接口调用失败，请检查设置");
}
