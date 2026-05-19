import { GithubAuthCard } from "@/components/github-auth-card";
import { GithubReposPanel } from "@/components/github-repos-panel";
import { WorkspaceCreateCard } from "@/components/workspace-create-card";
import { readCachedGithubAuthStatus } from "@/lib/services/github-auth";
import { readUserSettings } from "@/lib/services/local-user-settings-store";

export default async function GithubReposPage() {
  const [settings, cachedAuthStatus] = await Promise.all([readUserSettings(), readCachedGithubAuthStatus()]);

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">GitHub 仓库</h1>
            <p className="mt-2 text-sm text-slate-600">集中管理 GitHub 授权、仓库创建和本地工作区操作。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <WorkspaceCreateCard settings={settings} presentation="inline" initialAuthStatus={cachedAuthStatus} />
            <GithubAuthCard presentation="inline" initialStatus={cachedAuthStatus} />
          </div>
        </div>
      </section>

      <GithubReposPanel initialAuthStatus={cachedAuthStatus} />
    </div>
  );
}
