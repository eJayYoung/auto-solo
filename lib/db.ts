import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

function getSqliteDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl?.startsWith("file:")) {
    return configuredUrl;
  }

  return "/Users/ejay/auto-solo/prisma/dev.db";
}

const adapter = new PrismaBetterSqlite3({
  url: getSqliteDatabaseUrl(),
});

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({ adapter });
}

function hasExpectedDelegates(client: PrismaClient) {
  return "userSettings" in client && "taskRecord" in client && "workspaceProject" in client && "workspaceRun" in client;
}

const globalPrisma = global.prisma;
export const prisma = globalPrisma && hasExpectedDelegates(globalPrisma) ? globalPrisma : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
