# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

`auto-solo` is a local-first Next.js workbench for Solo Coder user-satisfaction annotation. It standardizes repetitive steps around Feishu Base syncing, prompt/task generation, GitHub repo preparation, Trae execution handoff, round scoring, and Feishu backfill while keeping subjective judgment and Trae execution manual.

## Commands

```bash
# Install dependencies
pnpm install

# Start local development server on port 3000
pnpm dev

# Production build / start
pnpm build
pnpm start

# Static checks
pnpm lint
pnpm typecheck

# Prisma / SQLite
pnpm db:generate
pnpm db:migrate
pnpm prisma migrate status
pnpm prisma studio

# Import legacy local JSON data, if needed
pnpm db:import-local
```

There is currently no test script in `package.json`; do not claim tests passed unless a test command has been added or you have run the relevant manual check. For UI changes, run `pnpm dev` and verify the affected route in the browser.

## Runtime requirements

- Local SQLite database lives at `prisma/dev.db`; Prisma uses `@prisma/adapter-better-sqlite3` and falls back to that file when `DATABASE_URL` is not a `file:` URL.
- Feishu integration is driven by `lark-cli` using user auth (`--as user`) and settings stored in the local DB.
- GitHub workspace creation requires `gh` and, when cloning, `git`.
- Opening Trae uses the configured app name on macOS/Windows; Trae itself remains a manual execution environment.
- Model calls use an OpenAI-compatible `/chat/completions` API configured in settings.

## High-level architecture

The app follows a Next.js App Router frontend/API layer backed by service modules and Prisma persistence:

- `app/` contains pages and route handlers. Pages render the workbench (`/`), task table (`/tasks`), task bank (`/task-bank`), GitHub/workspace page (`/github-repos`), settings, and Solo workflow pages (`/solo-workbench`). API routes call service functions and return `{ ok, data/error }` JSON.
- `components/` contains client-facing UI for the dashboard, settings form, task records/table, task bank actions, GitHub auth/workspace creation, and Solo workbench flows.
- `lib/services/` is the business/integration layer. Keep external integrations here rather than in components.
- `prisma/schema.prisma` is the source of truth for persisted entities: `TaskRecord`, `TaskBankItem`, `WorkspaceProject`, `WorkspaceRun`, `SoloSession`, `SoloRound`, `UserSettings`, GitHub auth status, and sync jobs.

Important service boundaries:

- `lib/services/feishu-base.ts` maps Feishu Base fields to local task records, downloads/uploads media attachments, and submits task fields back to Feishu via `lark-cli`.
- `lib/services/local-*-store.ts` modules wrap local persistence for task records, task bank items, user settings, and workspace project lists.
- `lib/services/task-generation.ts`, `task-testcase-generation.ts`, `solo-prompt-generation.ts`, and `dedupe.ts` handle model-backed generation, test case generation, and duplicate prevention.
- `lib/services/github-auth.ts`, `github-repos.ts`, and `github-workspace.ts` encapsulate `gh`, `git`, workspace directory setup under `workspace/<repo>/`, metadata writing, optional Trae launch, and Feishu backfill of GitHub URL/branch.
- `lib/services/workspace-runtime.ts` and `task-evaluation.ts` collect workspace/git artifacts and derive evaluation suggestions.
- `lib/services/solo-workflow.ts` manages the newer multi-round Solo session flow: session/round records, clone/open actions, prompt generation, git diff capture, model scoring, committing between rounds, and importing rounds back to Feishu.

## Data and workflow model

Core flow:

1. User logs in with Feishu; `proxy.ts` protects the main workbench routes by checking the `auto_solo_session` cookie.
2. Settings store Feishu app/Base config, session secret, GitHub defaults, local workspace preferences, Trae app name, and model endpoint/key.
3. Feishu records sync into local `TaskRecord` data; first-round prompts can seed `TaskBankItem` records.
4. Task bank generation creates candidate prompts, checks duplicates/similarity, and can auto-generate test cases after insertion.
5. Workspace creation uses GitHub settings to create repos, optionally clone to `workspace/<repo>/repo`, create `workspace/<repo>/diff`, open Trae, and optionally backfill Feishu task fields.
6. Solo workflow tracks up to five rounds per workspace/session, captures git status/diff, scores rounds through the model endpoint, and imports completed rounds to Feishu.

## External field conventions

Feishu field names are Chinese and are mapped explicitly in `feishu-base.ts` and related task-record code. Preserve these exact names when changing sync/backfill behavior, especially:

- `UID`, `Trae Session ID`, `轮次`, `User Prompt`
- `任务类型`, `业务领域`, `修改范围`
- `任务是否完成`, `产物及过程是否满意`, `不满意原因`
- `github地址`, `分支/文件夹`, `日志轨迹`, screenshot fields, `状态`

Round labels map `第一轮` through `第五轮` to numeric rounds 1-5. Solo sessions are constrained to a maximum of five rounds.

## Notes for future changes

- Prefer adding API behavior through service modules, then calling those services from `app/api/**/route.ts`; avoid putting shell/Lark/GitHub logic in React components.
- When touching Prisma models, update `prisma/schema.prisma`, add a migration, and run `pnpm db:generate`.
- The committed `prisma/dev.db` is local workflow state; inspect `git status` before committing database changes.
- `README.md`, `PLAN.md`, and `ARCHITECTURE.md` contain product context and may be stale relative to implemented code; verify against current service/API files before relying on details.
