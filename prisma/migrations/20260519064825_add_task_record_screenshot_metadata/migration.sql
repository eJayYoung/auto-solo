-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskRecord" (
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
    "screenshotAttachments" TEXT NOT NULL DEFAULT '[]',
    "screenshotFileToken" TEXT NOT NULL DEFAULT '',
    "screenshotExtra" TEXT NOT NULL DEFAULT '',
    "logs" TEXT NOT NULL DEFAULT '',
    "qcStatus" TEXT NOT NULL DEFAULT '',
    "syncStatus" TEXT NOT NULL DEFAULT 'draft',
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME,
    "lastRemoteUpdatedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_TaskRecord" ("branchOrFolder", "businessDomain", "githubUrl", "id", "lastRemoteUpdatedAt", "lastSyncedAt", "logs", "modifyScope", "processSatisfaction", "qcStatus", "recordId", "round", "screenshots", "syncStatus", "taskCompleted", "taskType", "traeSessionId", "uid", "unsatisfiedReason", "updatedAt", "userPrompt", "version") SELECT "branchOrFolder", "businessDomain", "githubUrl", "id", "lastRemoteUpdatedAt", "lastSyncedAt", "logs", "modifyScope", "processSatisfaction", "qcStatus", "recordId", "round", "screenshots", "syncStatus", "taskCompleted", "taskType", "traeSessionId", "uid", "unsatisfiedReason", "updatedAt", "userPrompt", "version" FROM "TaskRecord";
DROP TABLE "TaskRecord";
ALTER TABLE "new_TaskRecord" RENAME TO "TaskRecord";
CREATE UNIQUE INDEX "TaskRecord_recordId_key" ON "TaskRecord"("recordId");
CREATE INDEX "TaskRecord_uid_idx" ON "TaskRecord"("uid");
CREATE INDEX "TaskRecord_syncStatus_idx" ON "TaskRecord"("syncStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
