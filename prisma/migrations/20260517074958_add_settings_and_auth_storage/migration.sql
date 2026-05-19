-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "feishuAppId" TEXT NOT NULL DEFAULT '',
    "feishuAppSecret" TEXT NOT NULL DEFAULT '',
    "feishuRedirectUri" TEXT NOT NULL DEFAULT 'http://localhost:3000/api/auth/feishu/callback',
    "feishuBaseUrl" TEXT NOT NULL DEFAULT '',
    "sessionSecret" TEXT NOT NULL DEFAULT 'replace-with-a-long-random-secret',
    "githubOwner" TEXT NOT NULL DEFAULT 'example',
    "repoVisibility" TEXT NOT NULL DEFAULT 'private',
    "cloneEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openTraeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "localRoot" TEXT NOT NULL DEFAULT '~/solo_projects',
    "traeAppName" TEXT NOT NULL DEFAULT 'Trae',
    "modelProvider" TEXT NOT NULL DEFAULT 'openai_compatible',
    "modelBaseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "modelApiPath" TEXT NOT NULL DEFAULT '/chat/completions',
    "model" TEXT NOT NULL DEFAULT '',
    "modelKey" TEXT NOT NULL DEFAULT '',
    "dashboardMetricCardOrder" TEXT NOT NULL DEFAULT '[]',
    "dashboardActionCardOrder" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GithubAuthStatus" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "authorized" BOOLEAN NOT NULL,
    "message" TEXT,
    "accountName" TEXT,
    "checkedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
