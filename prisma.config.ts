import { existsSync } from "node:fs";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js uses .env.local in development. Prisma CLI does not load it by default;
// prefer it locally without changing production environment-variable behavior.
if (existsSync(".env.local")) {
  config({ path: ".env.local", override: true });
} else {
  config();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // DIRECT_URL avoids PgBouncer during DDL. DATABASE_URL is used at runtime.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
