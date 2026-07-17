import { config } from "dotenv";
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { readRuntimeEnv, runtimeEnvSchema, type RuntimeEnv } from "../../src/lib/env/schema";

export const LOCAL_ENV_PATH = ".env.local";

export function loadLocalEnvironment() {
  if (!existsSync(LOCAL_ENV_PATH)) {
    return { exists: false, env: undefined } as const;
  }

  // Setup commands intentionally validate the file the operator just edited. This prevents
  // empty inherited shell variables from masking .env.local during a local setup session.
  config({ path: LOCAL_ENV_PATH, override: true });
  const result = runtimeEnvSchema.safeParse(readRuntimeEnv());

  return {
    exists: true,
    env: result.success ? result.data : undefined,
    issues: result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))],
  } as const;
}

export function createScriptPrisma(env: RuntimeEnv) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
}

export function printSetupResult(label: string, result: "ok" | "pending" | "failed", detail: string) {
  const marker = result === "ok" ? "✓" : result === "pending" ? "•" : "!";
  console.log(`${marker} ${label}: ${detail}`);
}

export function failWithoutSensitiveDetails(label: string) {
  printSetupResult(label, "failed", "não foi possível concluir a verificação. Revise a configuração e as permissões.");
}
