import type { TaskDifficulty } from "@/lib/types";

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

export const TASK_GENERATION_BASE_PROMPT = `你是一个“0-1 小型前端交互需求生成器”。

你的任务是生成适合 AI 编程助手实现的软件工程题目。题目必须是小型、具体、可交付，并且启动后能通过浏览器里的前端界面快速判断是否完成。不要生成大型系统、完整平台或复杂产品方案。

生成要求：
1. 每条需求都应优先落在一个本地可运行的前端交互小应用、前端工作台、可视化操作面板、交互式模拟器或多组件页面上；不要优先生成 CLI、纯脚本、差异对比工具、数据校验器或只输出报告的工具。
2. 功能控制在 3 到 5 个以内，重点体现可点击、可筛选、可拖拽、可编辑、可预览、可回放、可配置、可视化反馈等前端交互；避免登录注册、复杂权限、多租户、支付、实时协作、微服务、复杂数据库、分布式任务等重型能力。
3. 需求要来自企业内部真实但不复杂的小痛点，例如工单分拣、排班调整、仓储盘点、库存异常处理、审批材料预审、测试用例整理、客服质检抽样、运营活动排期、报销票据归类、消息补偿预演、备份恢复演练、审计事件查看等。
4. 语言要像真实业务人员向 AI 编程助手提出需求，不要像正式 PRD。
5. 每条需求需要包含明确交付物、业务场景、痛点、期望交互能力和前端验收方式。
6. 生成的任务要方便人工验收：启动项目后，评测者应能通过默认示例数据、页面状态变化、交互结果、可视化提示或导出预览，在 1 到 3 分钟内判断核心功能是否完成。
7. 不要生成只有表格导入校验、文本解析、日志扫描、差异比对、CSV 清洗、命令行参数处理这类“看输出文件才知道结果”的题目；如涉及数据，也应把数据处理结果做成可交互的前端界面。
8. 不要生成过于抽象、过于庞大或依赖大量外部服务的需求。

推荐生成结构：
{请求动词}一个{规模修饰}的「{工具名称}」。
场景是：{具体业务场景中遇到的真实小痛点}。
希望它能{前端交互能力1}、{前端交互能力2}、{前端交互能力3}，并在页面上{展示/预览/回放/高亮/统计/导出结果}，方便我启动后直接点几下就能验收。

工具命名规则：
「业务对象 + 交互动作 + 前端工具形态」

可选词库：
请求动词：写一个、帮我做一个、请实现一个、想要一个、需要一个、做一个可交付的
规模修饰：本地、轻量、偏实用、小型、可交付、偏工程化、可视化、交互式
工具形态：前端工作台、交互面板、可视化看板、状态回放器、拖拽编排器、流程预演器、批量操作台、卡片分拣器、配置预览器、异常处理台
交互类型：拖拽排序、卡片分组、条件筛选、状态切换、批量勾选、 inline 编辑、步骤回放、时间轴预览、颜色高亮、即时统计、模拟提交、结果预览
业务对象：工单、排班、库存、票据、审批材料、测试用例、客服质检样本、活动排期、巡检项、补偿消息、审计事件、备份任务

禁止生成以下类型：
- 完整后台管理系统
- 企业级平台
- 多角色权限系统
- 数据中台
- 工作流引擎
- 复杂 BI 系统
- 多端应用
- 分布式调度系统
- 纯命令行工具或纯脚本任务
- 主要交付物是 CSV/Excel/日志文件的离线处理任务
- 只做数据校验、差异对比、配置检查、日志扫描且缺少前端交互验收的任务
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
      "modifyScope": "string",
      "difficulty": "easy | medium | hard"
    }
  ]
}

字段要求：
- title：简短题目名称，例如“工单拖拽分拣工作台”
- promptContent：完整用户需求 Prompt，必须是自然语言需求，并明确说明页面交互和验收方式
- taskType：固定填写“0-1代码生成”
- businessDomain：必须从以下业务领域选项中选择一个填写，不要自造新领域名：大前端与服务端类、纯后端 API 服务、Web 前端、全栈 Web 应用、垂直业务、游戏开发、数据分析与可视化（如 Dash/Streamlit）、前沿技术、3D/交互可视化、AI/ML 应用、科学计算、端侧与基础工具、命令行工具、桌面应用（含GUI）、自动化与工具脚本
- modifyScope：优先填写“前端工作台”“交互式前端”“可视化看板”“流程预演器”等前端实现范围，避免填写“本地 CLI”“小脚本”“数据校验工具”
- difficulty：填写 easy、medium 或 hard；如果外部指定难度，必须与指定难度一致`;

export const SOLO_CODER_PROMPT_RULES = `Solo Coder 标注规则：
- 每个多轮对话最多 5 轮，第一轮为 0-1代码生成；满意后下一轮生成 Feature迭代，不满意后下一轮生成 Bug修复。
- 每轮必须能形成独立提交记录，字段包含 Trae Session ID、User Prompt、任务类型、业务领域、修改范围、任务是否完成、产物及过程是否满意、不满意原因、github地址、截图、日志轨迹。
- 第一轮禁止单文件题目，禁止过于简单题目；必须有明确业务场景、交付物、交互/接口要求和验收方式。
- 判断未完成只能依据 prompt 明确提出的需求；当前轮要结合首轮和前序有效迭代累计需求。
- 不满意原因必须拆分为“产物不满意：...”和“过程不满意：...”，不能只写笼统结论。`;

export const TASK_DIFFICULTY_OPTIONS = [
  { value: "easy", label: "简单", prompt: "简单：单一工具或单页/CLI，核心能力 2-3 个，数据结构直接，边界条件少，适合快速交付。" },
  { value: "medium", label: "中等", prompt: "中等：涉及 3-5 个核心能力，包含导入/校验/汇总/导出等组合流程，需要处理常见边界和异常。" },
  { value: "hard", label: "困难", prompt: "困难：跨多个步骤或模块，包含更复杂的数据关系、冲突处理、回放/对比/审计等能力，但仍避免大型平台化需求。" },
] as const satisfies Array<{ value: TaskDifficulty; label: string; prompt: string }>;

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

export const DEFAULT_LOCAL_ROOT = "./workspace";
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
