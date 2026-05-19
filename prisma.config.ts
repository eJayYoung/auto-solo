import { defineConfig } from "prisma/config";

function getSqliteDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl?.startsWith("file:")) {
    return configuredUrl;
  }

  return "file:prisma/dev.db";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getSqliteDatabaseUrl(),
  },
});
