import "server-only";
import type { z } from "zod";
import { getOptionalPublicEnv, getPublicEnv } from "@/lib/env/public";
import { readServerEnv, serverEnvSchema } from "@/lib/env/schema";

export type ServerEnv = z.infer<typeof serverEnvSchema> & ReturnType<typeof getPublicEnv>;

/** Validates secrets only in server code and only when an integration is used. */
export function getServerEnv(): ServerEnv {
  return {
    ...getPublicEnv(),
    ...serverEnvSchema.parse(readServerEnv()),
  };
}

/** Allows the app shell to show a safe setup state until every server integration is configured. */
export function getOptionalServerEnv(): ServerEnv | undefined {
  const publicEnv = getOptionalPublicEnv();
  const serverEnv = serverEnvSchema.safeParse(readServerEnv()).data;
  return publicEnv && serverEnv ? { ...publicEnv, ...serverEnv } : undefined;
}
