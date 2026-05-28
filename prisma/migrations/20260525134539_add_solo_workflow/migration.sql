-- CreateTable
CREATE TABLE "SoloSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL DEFAULT '',
    "repoName" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "repoPath" TEXT NOT NULL,
    "diffRootPath" TEXT NOT NULL,
    "businessDomain" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SoloSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "WorkspaceProject" ("workspaceId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SoloRound" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL DEFAULT '',
    "roundNumber" INTEGER NOT NULL,
    "traeSessionId" TEXT NOT NULL DEFAULT '',
    "userPrompt" TEXT NOT NULL DEFAULT '',
    "taskType" TEXT NOT NULL DEFAULT '',
    "businessDomain" TEXT NOT NULL DEFAULT '',
    "modifyScope" TEXT NOT NULL DEFAULT '',
    "taskCompleted" TEXT NOT NULL DEFAULT '',
    "processSatisfaction" TEXT NOT NULL DEFAULT '',
    "productUnsatisfiedReason" TEXT NOT NULL DEFAULT '',
    "processUnsatisfiedReason" TEXT NOT NULL DEFAULT '',
    "combinedUnsatisfiedReason" TEXT NOT NULL DEFAULT '',
    "githubUrl" TEXT NOT NULL DEFAULT '',
    "branchOrFolder" TEXT NOT NULL DEFAULT '',
    "screenshotPath" TEXT NOT NULL DEFAULT '',
    "logsText" TEXT NOT NULL DEFAULT '',
    "gitStatusText" TEXT NOT NULL DEFAULT '',
    "gitDiffText" TEXT NOT NULL DEFAULT '',
    "diffFilePath" TEXT NOT NULL DEFAULT '',
    "artifactSummary" TEXT NOT NULL DEFAULT '',
    "nextPrompt" TEXT NOT NULL DEFAULT '',
    "importStatus" TEXT NOT NULL DEFAULT 'draft',
    "importError" TEXT NOT NULL DEFAULT '',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SoloRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SoloSession" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkspaceRun" (
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
    "gitStatusText" TEXT NOT NULL DEFAULT '',
    "gitDiffText" TEXT NOT NULL DEFAULT '',
    "diffFilePath" TEXT NOT NULL DEFAULT '',
    "suggestedTaskCompleted" TEXT NOT NULL DEFAULT '',
    "aiSuggestedSatisfaction" TEXT NOT NULL DEFAULT '',
    "aiSuggestedReason" TEXT NOT NULL DEFAULT '',
    "productUnsatisfiedReason" TEXT NOT NULL DEFAULT '',
    "processUnsatisfiedReason" TEXT NOT NULL DEFAULT '',
    "aiEvidence" TEXT NOT NULL DEFAULT '[]',
    "aiConfidence" TEXT,
    "userFinalSatisfaction" TEXT NOT NULL DEFAULT '',
    "userFinalReason" TEXT NOT NULL DEFAULT '',
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "WorkspaceProject" ("workspaceId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkspaceRun" ("aiConfidence", "aiEvidence", "aiSuggestedReason", "aiSuggestedSatisfaction", "artifactSummary", "branchName", "createdAt", "githubUrl", "id", "localPath", "logsText", "recordId", "repoName", "runId", "screenshotMimeType", "screenshotPath", "status", "submittedAt", "traeExportPath", "uid", "updatedAt", "userFinalReason", "userFinalSatisfaction", "workspaceId") SELECT "aiConfidence", "aiEvidence", "aiSuggestedReason", "aiSuggestedSatisfaction", "artifactSummary", "branchName", "createdAt", "githubUrl", "id", "localPath", "logsText", "recordId", "repoName", "runId", "screenshotMimeType", "screenshotPath", "status", "submittedAt", "traeExportPath", "uid", "updatedAt", "userFinalReason", "userFinalSatisfaction", "workspaceId" FROM "WorkspaceRun";
DROP TABLE "WorkspaceRun";
ALTER TABLE "new_WorkspaceRun" RENAME TO "WorkspaceRun";
CREATE UNIQUE INDEX "WorkspaceRun_runId_key" ON "WorkspaceRun"("runId");
CREATE INDEX "WorkspaceRun_workspaceId_idx" ON "WorkspaceRun"("workspaceId");
CREATE INDEX "WorkspaceRun_recordId_idx" ON "WorkspaceRun"("recordId");
CREATE INDEX "WorkspaceRun_uid_idx" ON "WorkspaceRun"("uid");
CREATE INDEX "WorkspaceRun_status_idx" ON "WorkspaceRun"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SoloSession_sessionId_key" ON "SoloSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SoloSession_workspaceId_key" ON "SoloSession"("workspaceId");

-- CreateIndex
CREATE INDEX "SoloSession_workspaceId_idx" ON "SoloSession"("workspaceId");

-- CreateIndex
CREATE INDEX "SoloSession_status_idx" ON "SoloSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SoloRound_roundId_key" ON "SoloRound"("roundId");

-- CreateIndex
CREATE INDEX "SoloRound_sessionId_idx" ON "SoloRound"("sessionId");

-- CreateIndex
CREATE INDEX "SoloRound_recordId_idx" ON "SoloRound"("recordId");

-- CreateIndex
CREATE INDEX "SoloRound_importStatus_idx" ON "SoloRound"("importStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SoloRound_sessionId_roundNumber_key" ON "SoloRound"("sessionId", "roundNumber");
