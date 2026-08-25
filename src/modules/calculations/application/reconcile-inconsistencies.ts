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
  const legacyCalculationIssueTypes = [
    "PROVISIONAL_EMPLOYEE",
    "MISSING_EMPLOYMENT_PERIOD",
    "MISSING_CALCULATION_POLICY",
    "MISSING_SCHEDULE",
    "ODD_PUNCH_COUNT",
    "MISSING_ENTRY",
    "MISSING_EXIT",
    "MISSING_BREAK_OUT",
    "MISSING_BREAK_RETURN",
    "INVALID_SEQUENCE",
    "POSSIBLE_DUPLICATE",
    "MULTIPLE_ENTRIES",
    "MULTIPLE_EXITS",
    "PUNCH_ON_DAY_OFF",
    "PUNCH_OUTSIDE_SCHEDULE",
    "LATE_ARRIVAL",
    "EARLY_DEPARTURE",
    "INTERVAL_TOO_SHORT",
    "INTERVAL_TOO_LONG",
    "EXCESS_TIME_PENDING",
    "INCOMPLETE_DAY",
    "NO_PUNCHES_ON_SCHEDULED_DAY",
  ] as const;
  // These reads are independent. Keeping them parallel avoids two sequential
  // database round trips for every employee-day in a bulk import.
  const [existing, legacyCalculationIssues] = await Promise.all([
    transaction.inconsistency.findMany({
      where: {
        dailySummaryId: input.dailySummaryId,
        calculationEngineVersion: input.calculationVersion,
        logicalKey: { not: null },
      },
      select: { id: true, logicalKey: true, status: true },
    }),
    transaction.inconsistency.findMany({
      where: {
        dailySummaryId: input.dailySummaryId,
        type: { in: [...legacyCalculationIssueTypes] },
        status: { in: ["OPEN", "IN_REVIEW", "REOPENED"] },
        OR: [{ calculationEngineVersion: null }, { calculationEngineVersion: { not: input.calculationVersion } }],
      },
      select: { id: true, type: true },
    }),
  ]);
  const existingByKey = new Map(existing.flatMap((item) => item.logicalKey ? [[item.logicalKey, item] as const] : []));
  const now = new Date();
  let created = 0;
  let autoResolved = 0;
  let reopened = 0;

  const desiredWrites = [...desired].map(([logicalKey, issue]) => {
    const previous = existingByKey.get(logicalKey);
    const status = reconcileInconsistencyStatus(previous, true);
    const metadata = { source: "CALCULATION_ENGINE", punchIds: issue.punchIds, context: issue.context, calculationVersion: input.calculationVersion };
    if (!previous) {
      created += 1;
      return transaction.inconsistency.create({
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
    }
    if (status === "REOPENED") reopened += 1;
    return transaction.inconsistency.update({
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
  });

  const staleWrites = existing.flatMap((previous) => {
    if (!previous.logicalKey || desired.has(previous.logicalKey)) return [];
    const status = reconcileInconsistencyStatus(previous, false);
    if (!status) return [];
    const write = transaction.inconsistency.update({
      where: { id: previous.id },
      data: { status, reconciledAt: now, autoResolvedAt: status === "AUTO_RESOLVED" ? now : undefined, resolutionReason: status === "AUTO_RESOLVED" ? "Resolvida automaticamente por recálculo reproduzível." : undefined },
    });
    if (status === "AUTO_RESOLVED") autoResolved += 1;
    return [write];
  });
  const desiredTypes = new Set<string>(input.issues.map((issue) => issue.type));
  const legacyWrites = legacyCalculationIssues.map((previous) => {
    autoResolved += 1;
    return transaction.inconsistency.update({
      where: { id: previous.id },
      data: {
        status: "AUTO_RESOLVED",
        reconciledAt: now,
        autoResolvedAt: now,
        resolutionReason: desiredTypes.has(previous.type)
          ? "Substituída pela inconsistência equivalente do recálculo reproduzível atual."
          : "Resolvida automaticamente porque não foi reproduzida pelo recálculo atual.",
      },
    });
  });
  await Promise.all([...desiredWrites, ...staleWrites, ...legacyWrites]);
  return { created, autoResolved, reopened };
}
