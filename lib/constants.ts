export const DEFAULT_FEISHU_BASE_URL =
  "https://bcnrsnl3m9wk.feishu.cn/base/HO1Kb3JQpa9e0WsHhQ0c2dpLnYb?table=tblfVRXx3qotQ4mO&view=vewKdKoVia";

export type FeishuBaseConfig = {
  baseToken: string;
  tableId: string;
  viewId?: string;
};

export function parseFeishuBaseUrl(value: string): FeishuBaseConfig {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("FEISHU_BASE_URL is invalid");
  }

  const baseToken = url.pathname.match(/^\/base\/([^/]+)$/)?.[1];
  const tableId = url.searchParams.get("table")?.trim() ?? "";
  const viewId = url.searchParams.get("view")?.trim() ?? "";

  if (!baseToken || !tableId) {
    throw new Error("FEISHU_BASE_URL must include base token and table id");
  }

  return {
    baseToken,
    tableId,
    viewId: viewId || undefined,
  };
}

export const TASK_GENERATION_BASE_PROMPT = `你是一个“0-1 小型代码需求生成器”。

你的任务是生成适合 AI 编程助手实现的软件工程题目。题目必须是小型、具体、可交付的工具型需求，不要生成大型系统、完整平台或复杂产品方案。

生成要求：
1. 每条需求都应该能通过一个本地 CLI、单页前端、小脚本、数据校验器、差异对比工具、报告生成器、巡检工具或模拟预演工具完成。
2. 功能控制在 3 到 5 个以内，避免登录注册、复杂权限、多租户、支付、实时协作、微服务、复杂数据库、分布式任务等重型能力。
3. 需求要来自企业内部真实但不复杂的小痛点，例如表格处理、财务对账、供应商管理、仓储盘点、审计记录、日志检查、配置巡检、数据导入校验、工单处理、排班检查、报表生成、测试数据整理、备份恢复演练、消息补偿核对、库存异常检查等。
4. 语言要像真实业务人员向 AI 编程助手提出需求，不要像正式 PRD。
5. 每条需求需要包含明确交付物、业务场景、痛点和期望能力。
6. 不要生成过于抽象、过于庞大或依赖大量外部服务的需求。

推荐生成结构：
{请求动词}一个{规模修饰}的「{工具名称}」。
场景是：{具体业务场景中遇到的真实小痛点}。
希望它能{核心能力1}、{核心能力2}、{核心能力3}，并{输出/展示/导出结果}。

工具命名规则：
「业务对象 + 问题类型 + 动作 + 工具形态」

可选词库：
请求动词：写一个、帮我做一个、请实现一个、想要一个、需要一个、做一个可交付的
规模修饰：本地、轻量、偏实用、小型、可交付、偏工程化、命令行、单页前端
工具形态：CLI、前端工具、校验脚本、报告生成器、差异对比工具、状态回放器、异常巡检工具、批量处理脚本、配置检查工具、模拟预演工具
问题类型：差异、漂移、冲突、缺测、超支、断档、脱敏、补偿、归档、降噪、验真、回放、巡检、预演

禁止生成以下类型：
- 完整后台管理系统
- 企业级平台
- 多角色权限系统
- 数据中台
- 工作流引擎
- 复杂 BI 系统
- 多端应用
- 分布式调度系统
- 需要接入真实第三方支付、短信、地图、IM 的项目
- 需要复杂部署、K8s、微服务的项目
- 需要长期维护的大型项目

输出要求：
只输出 JSON，不要输出 JSON 以外任何内容。
JSON 格式必须为：
{
  "tasks": [
    {
      "title": "string",
      "promptContent": "string",
      "taskType": "string",
      "businessDomain": "string",
      "modifyScope": "string"
    }
  ]
}

字段要求：
- title：简短题目名称，例如“供应商账期对账 CLI”
- promptContent：完整用户需求 Prompt，必须是自然语言需求
- taskType：固定填写“0-1代码生成”
- businessDomain：填写业务领域，例如“财务对账”“仓储管理”“运营表格”“日志检查”
- modifyScope：填写建议实现范围，例如“单页前端”“本地 CLI”“小脚本”“数据校验工具”`;

export const DEFAULT_MODEL = "gpt-5.4";

export const MODEL_OPTIONS = [
  "gpt-5.2",
  "gpt-5.3-codex",
  DEFAULT_MODEL,
  "codex-auto-review",
  "gpt-5.4-mini",
  "gpt-5.5",
] as const;

export const BUSINESS_DOMAIN_OPTIONS = [
  "大前端与服务端类",
  "纯后端 API 服务",
  "Web 前端",
  "全栈 Web 应用",
  "垂直业务",
  "游戏开发",
  "数据分析与可视化（如 Dash/Streamlit）",
  "前沿技术",
  "3D/交互可视化",
  "AI/ML 应用",
  "科学计算",
  "端侧与基础工具",
  "命令行工具",
  "桌面应用（含GUI）",
  "自动化与工具脚本",
] as const;

export const DEFAULT_LOCAL_ROOT = "~/solo_projects";
export const DEFAULT_TRAE_APP_NAME = "Trae CN";

export const FEISHU_OAUTH_AUTHORIZE_URL = "https://open.feishu.cn/open-apis/authen/v1/index";
export const FEISHU_OAUTH_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v2/oauth/token";
export const FEISHU_TENANT_ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
export const FEISHU_USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info";
export const FEISHU_SCOPE = "profile:read_user_email";
export const SESSION_COOKIE_NAME = "auto_solo_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LOGIN_REDIRECT_PATH = "/login";
export const FEISHU_REDIRECT_PATH = "/api/auth/feishu/callback";
