import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { calculationInconsistencyLogicalKey, reconcileInconsistencyStatus } from "@/modules/calculations/domain/inconsistency-reconciliation";
import type { EngineInconsistency } from "@/modules/calculations/domain/calculation-engine";

export async function reconcileCalculationInconsistencies(
  transaction: Prisma.TransactionClient,
  input: {
    employeeId: string;
    businessDate: Date;
    dailySummaryId: string;
    importFileId?: string;
    calculationVersion: string;
    issues: readonly EngineInconsistency[];
  },
) {
  const businessDate = input.businessDate.toISOString().slice(0, 10);
  const desired = new Map(input.issues.map((entry) => [calculationInconsistencyLogicalKey({ employeeId: input.employeeId, businessDate, issue: entry, calculationVersion: input.calculationVersion }), entry]));
  const existing = await transaction.inconsistency.findMany({
    where: {
      dailySummaryId: input.dailySummaryId,
      calculationEngineVersion: input.calculationVersion,
      logicalKey: { not: null },
    },
    select: { id: true, logicalKey: true, status: true },
  });
  const existingByKey = new Map(existing.flatMap((item) => item.logicalKey ? [[item.logicalKey, item] as const] : []));
  const now = new Date();
  let created = 0;
  let autoResolved = 0;
  let reopened = 0;

  for (const [logicalKey, issue] of desired) {
    const previous = existingByKey.get(logicalKey);
    const status = reconcileInconsistencyStatus(previous, true);
    const metadata = { source: "CALCULATION_ENGINE", punchIds: issue.punchIds, context: issue.context, calculationVersion: input.calculationVersion };
    if (!previous) {
      await transaction.inconsistency.create({
        data: {
          employeeId: input.employeeId,
          dailySummaryId: input.dailySummaryId,
          importFileId: input.importFileId,
          date: input.businessDate,
          type: issue.type,
          severity: issue.severity,
          status: "OPEN",
          description: issue.description,
          metadata,
          logicalKey,
          calculationEngineVersion: input.calculationVersion,
          reconciledAt: now,
        },
      });
      created += 1;
      continue;
    }
    await transaction.inconsistency.update({
      where: { id: previous.id },
      data: {
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        metadata,
        status,
        reconciledAt: now,
        reopenedAt: status === "REOPENED" ? now : undefined,
      },
    });
    if (status === "REOPENED") reopened += 1;
  }

  for (const previous of existing) {
    if (!previous.logicalKey || desired.has(previous.logicalKey)) continue;
    const status = reconcileInconsistencyStatus(previous, false);
    if (!status) continue;
    await transaction.inconsistency.update({
      where: { id: previous.id },
      data: { status, reconciledAt: now, autoResolvedAt: status === "AUTO_RESOLVED" ? now : undefined, resolutionReason: status === "AUTO_RESOLVED" ? "Resolvida automaticamente por recálculo reproduzível." : undefined },
    });
    if (status === "AUTO_RESOLVED") autoResolved += 1;
  }
  return { created, autoResolved, reopened };
}
