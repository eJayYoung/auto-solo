-- CreateTable
CREATE TABLE "TaskRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "traeSessionId" TEXT NOT NULL DEFAULT '',
    "round" INTEGER NOT NULL DEFAULT 1,
    "userPrompt" TEXT NOT NULL DEFAULT '',
    "taskType" TEXT NOT NULL DEFAULT '',
    "businessDomain" TEXT NOT NULL DEFAULT '',
    "modifyScope" TEXT NOT NULL DEFAULT '',
    "taskCompleted" TEXT NOT NULL DEFAULT '',
    "processSatisfaction" TEXT NOT NULL DEFAULT '',
    "unsatisfiedReason" TEXT NOT NULL DEFAULT '',
    "githubUrl" TEXT NOT NULL DEFAULT '',
    "branchOrFolder" TEXT NOT NULL DEFAULT '',
    "screenshots" TEXT NOT NULL DEFAULT '',
    "logs" TEXT NOT NULL DEFAULT '',
    "qcStatus" TEXT NOT NULL DEFAULT '',
    "syncStatus" TEXT NOT NULL DEFAULT 'draft',
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME,
    "lastRemoteUpdatedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "TaskBankItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "uidBinding" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "promptContent" TEXT NOT NULL,
    "promptMode" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT '',
    "businessDomain" TEXT NOT NULL DEFAULT '',
    "modifyScope" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fingerprint" TEXT
);

-- CreateTable
CREATE TABLE "WorkspaceProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "githubOwner" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "cloneEnabled" BOOLEAN NOT NULL,
    "traeOpened" BOOLEAN NOT NULL,
    "traeAppName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "triggeredBy" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncJobItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncJobId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "uid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncJobItem_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "SyncJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskRecord_recordId_key" ON "TaskRecord"("recordId");

-- CreateIndex
CREATE INDEX "TaskRecord_uid_idx" ON "TaskRecord"("uid");

-- CreateIndex
CREATE INDEX "TaskRecord_syncStatus_idx" ON "TaskRecord"("syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TaskBankItem_taskId_key" ON "TaskBankItem"("taskId");

-- CreateIndex
CREATE INDEX "TaskBankItem_uidBinding_idx" ON "TaskBankItem"("uidBinding");

-- CreateIndex
CREATE INDEX "TaskBankItem_status_idx" ON "TaskBankItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProject_workspaceId_key" ON "WorkspaceProject"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceProject_taskId_idx" ON "WorkspaceProject"("taskId");

-- CreateIndex
CREATE INDEX "SyncJobItem_syncJobId_idx" ON "SyncJobItem"("syncJobId");

-- CreateIndex
CREATE INDEX "SyncJobItem_recordId_idx" ON "SyncJobItem"("recordId");

-- CreateIndex
CREATE INDEX "SyncJobItem_status_idx" ON "SyncJobItem"("status");
