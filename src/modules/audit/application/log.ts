import { Prisma } from "@/generated/prisma/client";

export interface AuditContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

function redactValue(key: string, value: unknown): unknown {
  const normalized = key.toLowerCase();
  if (normalized.includes("password") || normalized.includes("secret") || normalized.includes("token") || normalized.includes("connection")) {
    return "[REDACTED]";
  }
  if (normalized === "cpf" && typeof value === "string") {
    return value.length >= 2 ? `***.***.***-${value.slice(-2)}` : "[MASKED]";
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeAuditData(entry));
  if (value && typeof value === "object") return sanitizeAuditData(value as Record<string, unknown>);
  return value;
}

/** Keeps operational history useful without placing credentials or a full CPF in general logs. */
export function sanitizeAuditData(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => sanitizeAuditData(entry) ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, redactValue(key, entry) ?? null]),
  ) as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  writer: AuditWriter,
  context: AuditContext,
  event: {
    action: string;
    entityType: string;
    entityId: string;
    oldData?: unknown;
    newData?: unknown;
    reason?: string;
  },
) {
  return writer.auditLog.create({
    data: {
      userId: context.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      oldData: sanitizeAuditData(event.oldData),
      newData: sanitizeAuditData(event.newData),
      reason: event.reason,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}
