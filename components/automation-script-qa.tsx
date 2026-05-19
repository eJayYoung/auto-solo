"use client";

import { useState } from "react";

const uploadTaskCommand = "pnpm tsx /Users/ejay/auto-solo/scripts/auto-solo-upload-task.ts";

const qaItems = [
  {
    question: "自动化脚本现在能完成什么？",
    answer: (
      <ul className="list-disc space-y-1 pl-5">
        <li>创建仓库并 clone 到本地后，系统会记录 workspaceId，并可在执行上传时一并写入 WorkspaceRun。</li>
        <li>在测试目录执行脚本后，会采集 GitHub remote、当前分支、本地路径、macOS 截图、可选日志、Trae 导出物和补充摘要。</li>
        <li>脚本会按 UID 或 recordId 找到任务记录，把采集结果直接写入任务表草稿。</li>
        <li>如果能识别到 workspaceId，任务表还会展示最近一次运行记录；人工确认后点击“同步”回填飞书。</li>
      </ul>
    ),
  },
  {
    question: "标准使用流程是什么？",
    answer: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>在工作台或 GitHub 仓库页创建仓库，勾选 clone 到本地并打开 Trae。</li>
        <li>在 Trae 中粘贴题目并执行测试任务。</li>
        <li>进入测试项目目录，执行自动采集并上传到任务表的命令。</li>
        <li>回到任务表检查草稿字段。</li>
        <li>人工检查并修改草稿后，点击“同步”回填飞书。</li>
      </ol>
    ),
  },
  {
    question: "在测试项目目录里执行什么命令？",
    answer: (
      <div className="space-y-3">
        <div>
          <div className="text-slate-500">基础命令：</div>
          <code className="mt-1 block rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">{uploadTaskCommand}</code>
        </div>
        <div>
          <div className="text-slate-500">指定 UID：</div>
          <code className="mt-1 block rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">{`${uploadTaskCommand} --uid UID-xxxx`}</code>
        </div>
        <div>
          <div className="text-slate-500">带日志文件：</div>
          <code className="mt-1 block rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">{`${uploadTaskCommand} --log-file ./logs.txt`}</code>
        </div>
        <div>
          <div className="text-slate-500">带 Trae 导出物和补充摘要：</div>
          <code className="mt-1 block whitespace-pre-wrap rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">{`${uploadTaskCommand} \\\n  --trae-export ./trae-export.json \\\n  --summary "页面可以打开，但提交表单时报 500"`}</code>
        </div>
      </div>
    ),
  },
  {
    question: "没有 workspaceId 也能用吗？",
    answer: (
      <div className="space-y-2">
        <p>可以。执行上传脚本时输入 UID，或显式传入 --uid / --record-id，脚本会直接匹配任务记录并写入草稿。</p>
        <code className="block rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">{`${uploadTaskCommand} --uid UID-xxxx`}</code>
      </div>
    ),
  },
  {
    question: "有哪些注意事项？",
    answer: (
      <ul className="list-disc space-y-1 pl-5">
        <li>自动截图目前优先支持 macOS，底层使用 screencapture。</li>
        <li>脚本会直接写入本地任务表草稿，不会自动同步到飞书。</li>
        <li>最终回填仍使用任务表里的“同步”按钮，复用现有飞书提交流程。</li>
      </ul>
    ),
  },
];

export function AutomationScriptQa() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">页面 QA：测试目录自动采集脚本</h2>
            <p className="mt-1 text-sm text-slate-600">查看自动上传脚本的能力、流程、命令和注意事项。</p>
          </div>
          <button
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            查看 QA
          </button>
        </div>
      </section>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="automation-script-qa-title">
          <div className="flex max-h-full w-full max-w-4xl flex-col rounded-3xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <h2 id="automation-script-qa-title" className="text-lg font-semibold text-slate-950">页面 QA：测试目录自动采集脚本</h2>
                <p className="mt-1 text-sm text-slate-600">用于把 Trae 执行后的 Git 信息、截图、日志沉淀回任务表草稿。</p>
              </div>
              <button className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700" onClick={() => setIsOpen(false)} type="button">
                关闭
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-6">
              {qaItems.map((item) => (
                <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm" key={item.question}>
                  <h3 className="font-medium text-slate-950">{item.question}</h3>
                  <div className="mt-2 leading-6 text-slate-600">{item.answer}</div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
