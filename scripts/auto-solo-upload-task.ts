import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile } from "node:fs/promises";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { captureWorkspaceScreenshot, collectWorkspaceRuntime, createWorkspaceRun } from "../lib/services/workspace-runtime";
import { uploadWorkspaceRuntimeToTaskRecord } from "../lib/services/local-task-record-store";

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readOptionalFile(path?: string) {
  return path ? readFile(path, "utf8") : "";
}

async function promptForUid() {
  const readline = createInterface({ input, output });
  try {
    return (await readline.question("请输入 UID: ")).trim();
  } finally {
    readline.close();
  }
}

function getSqliteDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl?.startsWith("file:")) {
    return configuredUrl;
  }

  return "/Users/ejay/auto-solo/prisma/dev.db";
}

async function resolveTaskRecord(input: { recordId?: string; uid?: string }) {
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: getSqliteDatabaseUrl() }) });
  try {
    if (input.recordId) {
      const record = await prisma.taskRecord.findUnique({ where: { recordId: input.recordId } });
      if (!record) {
        throw new Error(`Task record not found: ${input.recordId}`);
      }
      if (input.uid && record.uid !== input.uid) {
        throw new Error(`Task record UID mismatch: expected ${record.uid}, received ${input.uid}`);
      }
      return record;
    }

    if (!input.uid) {
      throw new Error("UID is required");
    }

    const records = await prisma.taskRecord.findMany({ where: { uid: input.uid }, orderBy: { updatedAt: "desc" } });
    if (records.length === 0) {
      throw new Error(`Task record not found for UID: ${input.uid}`);
    }
    if (records.length > 1) {
      throw new Error(`Multiple task records found for UID ${input.uid}; rerun with --record-id <recordId>`);
    }
    return records[0];
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const directory = getArg("--dir") || process.cwd();
  const logFile = getArg("--log-file");
  const uid = getArg("--uid") || (await promptForUid());
  if (!uid) {
    throw new Error("UID is required");
  }

  const screenshotPath = getArg("--screenshot") || (await captureWorkspaceScreenshot(directory));
  const payload = await collectWorkspaceRuntime(directory, {
    uid,
    recordId: getArg("--record-id"),
    screenshotPath,
    screenshotMimeType: screenshotPath ? "image/png" : "",
    traeExportPath: getArg("--trae-export") || "",
    logsText: getArg("--logs") || (await readOptionalFile(logFile)),
    artifactSummary: getArg("--summary") || "",
  });
  const taskRecord = await resolveTaskRecord({ recordId: payload.recordId, uid: payload.uid });
  const run = payload.workspaceId ? await createWorkspaceRun({ ...payload, recordId: taskRecord.recordId }) : null;
  const updatedTaskRecord = await uploadWorkspaceRuntimeToTaskRecord({ ...payload, recordId: taskRecord.recordId });

  console.log(JSON.stringify({ ok: true, data: { run, taskRecord: updatedTaskRecord } }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
