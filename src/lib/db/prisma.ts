import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env/server";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const { DATABASE_URL } = getServerEnv();
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
}

/**
 * Creates the client only when a database-backed operation runs. This keeps static pages and
 * build-time route analysis available before a Supabase environment is configured.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
