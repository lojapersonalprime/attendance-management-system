import "server-only";

import { headers } from "next/headers";
import type { AuditContext } from "@/modules/audit/application/log";
import { requireRhAdmin } from "@/modules/auth/server/session";

export async function requireAuditContext(): Promise<AuditContext> {
  const profile = await requireRhAdmin();
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    userId: profile.id,
    ipAddress: forwarded || requestHeaders.get("x-real-ip") || undefined,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 1_000) || undefined,
  };
}
