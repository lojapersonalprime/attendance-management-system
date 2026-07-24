import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { canClosePeriod } from "@/modules/closing/domain/period";

const referenceSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe a competência no formato AAAA-MM.");
const reasonSchema = z.string().trim().min(3, "Informe a justificativa.").max(2_000);

function monthRange(reference: string) {
  const start = new Date(`${reference}-01T00:00:00.000Z`);
  return { start, end: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
}

export async function closeCalculationPeriod(input: { reference: string; reason: string; context: AuditContext }) {
  const reference = referenceSchema.parse(input.reference);
  const reason = reasonSchema.parse(input.reason);
  const { start, end } = monthRange(reference);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const criticalOpenCount = await transaction.inconsistency.count({
      where: { date: { gte: start, lt: end }, severity: "CRITICAL", status: { in: ["OPEN", "IN_REVIEW", "REOPENED"] } },
    });
    if (!canClosePeriod(criticalOpenCount > 0)) throw new Error("Há inconsistências críticas abertas nesta competência.");
    const previous = await transaction.closingPeriod.findUnique({ where: { referenceMonth: start } });
    if (previous?.status === "CLOSED") throw new Error("Esta competência já está fechada.");
    const period = previous
      ? await transaction.closingPeriod.update({ where: { id: previous.id }, data: { status: "CLOSED", closedById: input.context.userId, closedAt: new Date() } })
      : await transaction.closingPeriod.create({ data: { referenceMonth: start, status: "CLOSED", closedById: input.context.userId, closedAt: new Date() } });
    await writeAuditLog(transaction, input.context, {
      action: "CALCULATION_PERIOD_CLOSED",
      entityType: "ClosingPeriod",
      entityId: period.id,
      oldData: previous ? { status: previous.status } : undefined,
      newData: { reference, status: period.status, criticalOpenCount },
      reason,
    });
    return period;
  });
}

export async function reopenCalculationPeriod(input: { reference: string; reason: string; context: AuditContext }) {
  const reference = referenceSchema.parse(input.reference);
  const reason = reasonSchema.parse(input.reason);
  const { start } = monthRange(reference);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.closingPeriod.findUniqueOrThrow({ where: { referenceMonth: start } });
    if (previous.status !== "CLOSED") throw new Error("Esta competência já está aberta.");
    const period = await transaction.closingPeriod.update({
      where: { id: previous.id },
      data: { status: "OPEN", reopenedById: input.context.userId, reopenedAt: new Date(), reopenReason: reason },
    });
    await writeAuditLog(transaction, input.context, {
      action: "CALCULATION_PERIOD_REOPENED",
      entityType: "ClosingPeriod",
      entityId: period.id,
      oldData: { status: previous.status },
      newData: { reference, status: period.status },
      reason,
    });
    return period;
  });
}
