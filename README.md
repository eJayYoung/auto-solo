# auto-solo

Solo Coder 用户满意度标注工作台，用一个 Next.js 全栈应用承接飞书同步、题目生成、GitHub 仓库准备、任务编辑和飞书回填等高重复步骤。

## 项目定位

`auto-solo` 是一个半自动化提效系统，不替代人工判断。系统负责标准化、可重复的操作，人工仍负责在 Trae 中执行任务、判断任务是否完成、评价产物及过程是否满意，并在飞书中触发 AI 质检。

核心目标：

- 将分散在飞书表格、脚本、GitHub 和 Trae 之间的操作收敛到一个工作台。
- 降低复制粘贴、字段整理、仓库创建和回填的重复成本。
- 保留人工对标注质量、满意度和不满意原因的判断。

## 主要功能

### 工作台

首页集中展示任务记录、待绑定 UID、题库题目和工作区项目等指标，并承接高频操作：

- 同步飞书 Base 任务记录。
- 生成题目并沉淀到题库。
- 检查 GitHub 授权状态。
- 创建 GitHub 仓库、可选 clone 到本地、可选打开 Trae。

### 任务表

任务表用于管理从飞书 Base 同步下来的标注记录：

- 查看本地任务记录。
- 按任务字段进行编辑和整理。
- 补充 Trae Session ID、User Prompt、任务类型、业务领域、修改范围、GitHub 地址、日志轨迹、不满意原因等字段。
- 将编辑后的字段提交回飞书 Base。

### 题库表

题库表用于沉淀历史题目和生成新题目：

- 从历史第一轮 User Prompt 沉淀题目。
- 手动维护或批量生成题目。
- 生成时根据已有题目做重复和相似度校验。
- 支持复制题目内容。
- 支持删除未提交题目。

### GitHub 与 Trae 工作区

工作区流程用于准备实际执行任务的工程环境：

- 通过 `gh` CLI 创建 GitHub 仓库。
- 可选 clone 仓库到本地目录。
- 可选打开 Trae 应用。
- 记录已创建的工作区项目。
- 可在批量创建时回填 GitHub 地址和分支/文件夹信息。

### 设置中心

设置中心保存本地运行所需配置：

- 飞书 App ID、App Secret、OAuth 回调地址、飞书 Base 地址。
- 本地会话签名密钥。
- GitHub owner、仓库可见性、是否 clone、是否打开 Trae、本地目录、Trae 应用名称。
- OpenAI-compatible 模型接口 Base URL、API path、模型名称和密钥。

敏感配置保存在本地 SQLite 数据库中，不要把真实密钥提交到代码仓库。

## 页面入口

本地启动后可访问以下页面：

| 路径 | 用途 |
| --- | --- |
| `/` | 工作台首页 |
| `/login` | 飞书登录页 |
| `/tasks` | 任务表 |
| `/task-bank` | 题库表 |
| `/github-repos` | GitHub / 工作区项目 |
| `/settings` | 设置中心 |

## 本地启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 生成 Prisma Client

```bash
pnpm db:generate
```

### 3. 初始化或同步数据库

本项目当前使用 SQLite 本地文件数据库，数据库文件位于：

```text
prisma/dev.db
```

如果是首次启动或需要同步 schema，执行：

```bash
pnpm db:migrate
```

如果仓库中已经有可用的 `prisma/dev.db`，也可以直接启动开发服务。

### 4. 启动开发服务

```bash
pnpm dev
```

访问：

```text
http://localhost:3000
```

未登录时会被重定向到登录页，点击“飞书登录”完成授权后进入工作台。

## 飞书登录配置

本项目使用飞书 OAuth 登录。启动本地开发前，需要先在飞书开放平台创建应用，并在应用的设置页面填写飞书配置。

### 1. 创建飞书应用

1. 打开飞书开放平台：`https://open.feishu.cn/`
2. 进入开发者后台的“我的应用”
3. 创建一个“企业自建应用”，例如命名为 `auto-solo`
4. 进入应用详情页，打开“凭证与基础信息”
5. 复制 `App ID` 和 `App Secret`，稍后填入 auto-solo 的设置页面。

### 2. 配置 OAuth 回调地址

在飞书应用后台的安全设置或重定向 URL 配置中，添加本地回调地址：

```text
http://localhost:3000/api/auth/feishu/callback
```

这个地址必须和 auto-solo 设置页面中的“飞书回调地址”保持一致。

### 3. 配置应用设置

启动开发服务后，进入 `http://localhost:3000/settings`，填写：

- 飞书 App ID
- 飞书 App Secret
- 飞书回调地址
- 飞书表格地址
- 会话签名密钥

说明：

- App ID 和 App Secret 来自飞书开放平台应用详情页。
- 飞书回调地址是飞书登录成功后的回调地址。
- 会话签名密钥不是飞书提供的值，需要自己生成一段足够长的随机字符串，用于签名本地登录 cookie。
- 飞书 Base 地址用于同步和回填多维表格记录。

## GitHub 与本地工具要求

使用仓库创建和本地工作区功能时，需要本机具备以下工具：

- `gh`：用于创建 GitHub 仓库和检查授权状态。
- `git`：用于 clone 仓库。
- Trae：如果开启“打开 Trae”，需要本机已安装 Trae，并且设置中的应用名称与系统应用名称一致。

建议先在终端完成 GitHub CLI 登录：

```bash
gh auth login
```

## 模型配置

题目生成功能使用 OpenAI-compatible Chat Completions 接口。需要在设置中心配置：

- Model Base URL，例如 `https://api.openai.com/v1`
- Model API Path，例如 `/chat/completions`
- Model，例如 `gpt5.4`
- Model Key

如果接口地址不带 `/v1`，系统会尝试兼容 `/chat/completions` 与 `/v1/chat/completions` 两种路径。

## 数据库

本项目当前使用 SQLite 本地文件数据库，不需要单独启动数据库服务。数据库文件位于：

```text
prisma/dev.db
```

常用数据库命令：

```bash
# 查看迁移状态
pnpm prisma migrate status

# 执行/同步迁移
pnpm db:migrate

# 生成 Prisma Client
pnpm db:generate

# 把 .data/*.json 导入数据库
pnpm db:import-local

# 打开 Prisma Studio 查看和编辑数据库内容
pnpm prisma studio
```

## 常用命令

```bash
# 启动开发服务
pnpm dev

# 生产构建
pnpm build

# 启动生产服务
pnpm start

# ESLint 检查
pnpm lint

# TypeScript 类型检查
pnpm typecheck

# 生成 Prisma Client
pnpm db:generate

# 执行数据库迁移
pnpm db:migrate

# 导入本地 JSON 数据
pnpm db:import-local
```

## 当前限制

- Trae 内部的模型对话、代码执行和多轮推进仍需人工完成。
- “任务是否完成”“产物及过程是否满意”“不满意原因”等主观字段仍需人工判断。
- 飞书 AI 质检仍需人工在飞书表格中点击。
- GitHub 仓库创建依赖本机 `gh` CLI 授权。
- clone 功能依赖本机 `git`。
- 打开 Trae 目前依赖本机系统能力和应用名称配置。
- 项目当前以本地 SQLite 为存储，适合单机本地工作流。

## 参考文档

- 项目规划：`PLAN.md`
- 架构设计：`ARCHITECTURE.md`
