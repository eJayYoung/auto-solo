import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readCachedGithubAuthStatus } from "@/lib/services/github-auth";
import { openTraeApp } from "@/lib/services/github-workspace";
import { readUserSettings, readWorkspaceProjects } from "@/lib/services/local-user-settings-store";

const execFileAsync = promisify(execFile);

type GithubRepoListItem = {
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
};

export type GithubRepoItem = {
  name: string;
  fullName: string;
  httpsUrl: string;
  localPath?: string;
};

export type GithubReposResult = {
  accountName: string;
  repos: GithubRepoItem[];
};

export class GithubAuthRequiredError extends Error {
  constructor(message = "请先授权 GitHub") {
    super(message);
    this.name = "GithubAuthRequiredError";
  }
}

const assertAuthorizedOrThrow = async () => {
  const authStatus = await readCachedGithubAuthStatus();
  if (!authStatus?.authorized) {
    throw new GithubAuthRequiredError(authStatus?.message || "请先授权 GitHub");
  }

  return authStatus.accountName || "Unknown";
};

export async function listGithubRepos(): Promise<GithubReposResult> {
  const accountName = await assertAuthorizedOrThrow();
  const projects = await readWorkspaceProjects();
  const localPathsByFullName = new Map(
    projects.map((project) => [`${project.githubOwner}/${project.repoName}`, project.localPath]),
  );
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      "gh",
      ["api", `users/${accountName}/repos`, "--method", "GET", "--paginate", "-f", "per_page=100"],
      { maxBuffer: 10 * 1024 * 1024 },
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("HTTP 404")) {
      throw error;
    }

    ({ stdout } = await execFileAsync(
      "gh",
      ["api", `orgs/${accountName}/repos`, "--method", "GET", "--paginate", "-f", "per_page=100"],
      { maxBuffer: 10 * 1024 * 1024 },
    ));
  }

  const repoList = JSON.parse(stdout) as GithubRepoListItem[];
  return {
    accountName,
    repos: repoList.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      httpsUrl: repo.clone_url || repo.html_url,
      localPath: localPathsByFullName.get(repo.full_name),
    })),
  };
}

export async function deleteGithubRepo(repoFullName: string): Promise<void> {
  await assertAuthorizedOrThrow();

  const normalizedRepoFullName = repoFullName.trim();
  const [owner, repo] = normalizedRepoFullName.split("/");
  if (!owner || !repo || normalizedRepoFullName.split("/").length !== 2) {
    throw new Error("repoFullName must be in owner/repo format");
  }

  await execFileAsync("gh", ["repo", "delete", normalizedRepoFullName, "--yes"], {
    maxBuffer: 10 * 1024 * 1024,
  });
}

export async function openGithubRepoWithTrae(repoFullName: string): Promise<void> {
  await assertAuthorizedOrThrow();

  const normalizedRepoFullName = repoFullName.trim();
  const [owner, repo] = normalizedRepoFullName.split("/");
  if (!owner || !repo || normalizedRepoFullName.split("/").length !== 2) {
    throw new Error("repoFullName must be in owner/repo format");
  }

  const projects = await readWorkspaceProjects();
  const project = projects.find((item) => item.githubOwner === owner && item.repoName === repo);
  if (!project) {
    throw new Error("未找到该仓库对应的本地目录，请先通过工作台创建并 clone 仓库。");
  }

  const settings = await readUserSettings();
  await openTraeApp(settings.traeAppName, project.localPath);
}
