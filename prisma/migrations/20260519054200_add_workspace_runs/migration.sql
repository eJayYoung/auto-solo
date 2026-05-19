-- CreateTable
CREATE TABLE "WorkspaceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "repoName" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "screenshotPath" TEXT NOT NULL DEFAULT '',
    "screenshotMimeType" TEXT NOT NULL DEFAULT '',
    "traeExportPath" TEXT NOT NULL DEFAULT '',
    "logsText" TEXT NOT NULL DEFAULT '',
    "artifactSummary" TEXT NOT NULL DEFAULT '',
    "aiSuggestedSatisfaction" TEXT NOT NULL DEFAULT '',
    "aiSuggestedReason" TEXT NOT NULL DEFAULT '',
    "aiEvidence" TEXT NOT NULL DEFAULT '[]',
    "aiConfidence" TEXT,
    "userFinalSatisfaction" TEXT NOT NULL DEFAULT '',
    "userFinalReason" TEXT NOT NULL DEFAULT '',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "WorkspaceProject" ("workspaceId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkspaceProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL DEFAULT '',
    "uid" TEXT NOT NULL DEFAULT '',
    "repoName" TEXT NOT NULL,
    "githubOwner" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "currentBranch" TEXT NOT NULL DEFAULT '',
    "metadataPath" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL,
    "cloneEnabled" BOOLEAN NOT NULL,
    "traeOpened" BOOLEAN NOT NULL,
    "traeAppName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "lastCollectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WorkspaceProject" ("cloneEnabled", "createdAt", "errorMessage", "githubOwner", "githubUrl", "id", "localPath", "repoName", "status", "taskId", "traeAppName", "traeOpened", "visibility", "workspaceId") SELECT "cloneEnabled", "createdAt", "errorMessage", "githubOwner", "githubUrl", "id", "localPath", "repoName", "status", "taskId", "traeAppName", "traeOpened", "visibility", "workspaceId" FROM "WorkspaceProject";
DROP TABLE "WorkspaceProject";
ALTER TABLE "new_WorkspaceProject" RENAME TO "WorkspaceProject";
CREATE UNIQUE INDEX "WorkspaceProject_workspaceId_key" ON "WorkspaceProject"("workspaceId");
CREATE INDEX "WorkspaceProject_taskId_idx" ON "WorkspaceProject"("taskId");
CREATE INDEX "WorkspaceProject_recordId_idx" ON "WorkspaceProject"("recordId");
CREATE INDEX "WorkspaceProject_uid_idx" ON "WorkspaceProject"("uid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRun_runId_key" ON "WorkspaceRun"("runId");

-- CreateIndex
CREATE INDEX "WorkspaceRun_workspaceId_idx" ON "WorkspaceRun"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceRun_recordId_idx" ON "WorkspaceRun"("recordId");

-- CreateIndex
CREATE INDEX "WorkspaceRun_uid_idx" ON "WorkspaceRun"("uid");

-- CreateIndex
CREATE INDEX "WorkspaceRun_status_idx" ON "WorkspaceRun"("status");
