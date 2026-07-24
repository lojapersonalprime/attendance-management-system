import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";

const manualInconsistencyStatusSchema = z.enum(["IN_REVIEW", "DISMISSED"]);

const updateInconsistencySchema = z.object({
  inconsistencyId: z.string().min(1),
  status: manualInconsistencyStatusSchema,
  reason: z.string().trim().min(3, "Informe a justificativa do tratamento.").max(2_000),
});

/** Records review or dismissal without deleting calculation history. Resolution is only produced by a valid treatment and reconciliation. */
export async function updateInconsistencyStatus(input: { value: unknown; context: AuditContext }) {
  const value = updateInconsistencySchema.parse(input.value);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.inconsistency.findUniqueOrThrow({
      where: { id: value.inconsistencyId },
      select: { id: true, status: true, type: true, employeeId: true, date: true, resolutionReason: true },
    });
    if (!["OPEN", "REOPENED", "IN_REVIEW"].includes(previous.status)) throw new Error("Esta pendência já não aceita tratamento manual.");
    const now = new Date();
    const inconsistency = await transaction.inconsistency.update({
      where: { id: previous.id },
      data: {
        status: value.status,
        resolvedById: value.status === "IN_REVIEW" ? null : input.context.userId,
        resolvedAt: value.status === "IN_REVIEW" ? null : now,
        resolutionReason: value.status === "IN_REVIEW" ? null : value.reason,
      },
    });
    await writeAuditLog(transaction, input.context, {
      action: "INCONSISTENCY_STATUS_UPDATED",
      entityType: "Inconsistency",
      entityId: inconsistency.id,
      oldData: { status: previous.status, resolutionReason: previous.resolutionReason },
      newData: { status: inconsistency.status, type: previous.type, employeeId: previous.employeeId, date: previous.date },
      reason: value.reason,
    });
    return inconsistency;
  });
}
