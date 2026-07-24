import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { toBusinessDate } from "@/lib/dates/business";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";

type ClosingPeriodWriter = Pick<Prisma.TransactionClient, "closingPeriod" | "auditLog">;

function monthStart(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00.000Z`);
}

/**
 * Context changes that would reinterpret an already closed competence must be
 * rejected before the contextual record is written. The denied attempt itself
 * remains auditable without changing any calculation or RawPunch.
 */
export async function assertOpenCalculationMonths(
  writer: ClosingPeriodWriter,
  input: {
    validFrom: string;
    validUntil?: string | null;
    context: AuditContext;
    entityType: string;
    entityId: string;
    action: string;
  },
) {
  const today = toBusinessDate(new Date());
  const effectiveUntil = input.validUntil && input.validUntil < today ? input.validUntil : today;
  if (input.validFrom > effectiveUntil) return;

  const closed = await writer.closingPeriod.findMany({
    where: {
      status: "CLOSED",
      referenceMonth: { gte: monthStart(input.validFrom), lte: monthStart(effectiveUntil) },
    },
    select: { referenceMonth: true },
  });
  if (closed.length === 0) return;

  const closedMonths = closed.map((period) => period.referenceMonth.toISOString().slice(0, 7));
  await writeAuditLog(writer, input.context, {
    action: "CLOSED_PERIOD_CHANGE_ATTEMPT",
    entityType: input.entityType,
    entityId: input.entityId,
    newData: { requestedAction: input.action, validFrom: input.validFrom, validUntil: input.validUntil ?? null, closedMonths },
    reason: "Alteração bloqueada: a competência precisa ser reaberta antes do recálculo.",
  });
  throw new Error("A competência está fechada. Reabra-a com justificativa antes de alterar este contexto histórico.");
}
