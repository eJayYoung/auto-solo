-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskBankItem" (
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
    "testCasesJson" TEXT NOT NULL DEFAULT '',
    "testCasesGeneratedAt" DATETIME,
    "testCasesModel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fingerprint" TEXT
);
INSERT INTO "new_TaskBankItem" ("businessDomain", "createdAt", "fingerprint", "id", "model", "modifyScope", "promptContent", "promptMode", "sourceType", "status", "submittedAt", "taskId", "taskType", "title", "uidBinding") SELECT "businessDomain", "createdAt", "fingerprint", "id", "model", "modifyScope", "promptContent", "promptMode", "sourceType", "status", "submittedAt", "taskId", "taskType", "title", "uidBinding" FROM "TaskBankItem";
DROP TABLE "TaskBankItem";
ALTER TABLE "new_TaskBankItem" RENAME TO "TaskBankItem";
CREATE UNIQUE INDEX "TaskBankItem_taskId_key" ON "TaskBankItem"("taskId");
CREATE INDEX "TaskBankItem_uidBinding_idx" ON "TaskBankItem"("uidBinding");
CREATE INDEX "TaskBankItem_status_idx" ON "TaskBankItem"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
