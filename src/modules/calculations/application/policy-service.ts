import "server-only";

import { toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";
import { assertOpenCalculationMonths } from "@/modules/calculations/application/closed-period-guard";
import { defaultCalculationPolicies } from "@/modules/calculations/domain/policies";
import { calculationPolicyInputSchema } from "@/modules/calculations/domain/validation";

export async function ensureDefaultCalculationPolicies(context: AuditContext) {
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const policies = [];
    for (const definition of defaultCalculationPolicies) {
      const { key, ...policyData } = definition;
      void key;
      const policy = await transaction.calculationPolicy.upsert({
        where: { name: definition.name },
        create: policyData,
        update: {},
      });
      policies.push(policy);
    }
    await writeAuditLog(transaction, context, {
      action: "CALCULATION_POLICY_DEFAULTS_ENSURED",
      entityType: "CalculationPolicy",
      entityId: "default-policies",
      newData: { policyIds: policies.map((policy) => policy.id), count: policies.length },
      reason: "Políticas sintéticas iniciais da v0.3.0.",
    });
    return policies;
  });
}

export async function saveCalculationPolicy(input: { id?: string; value: unknown; context: AuditContext }) {
  const value = calculationPolicyInputSchema.parse(input.value);
  const prisma = getPrisma();
  const changed = await prisma.$transaction(async (transaction) => {
    const previous = input.id ? await transaction.calculationPolicy.findUniqueOrThrow({ where: { id: input.id } }) : null;
    const periods = previous
      ? await transaction.employeeEmploymentPeriod.findMany({
        where: { calculationPolicyId: previous.id },
        select: { employeeId: true, validFrom: true, validUntil: true },
      })
      : [];
    for (const period of periods) {
      await assertOpenCalculationMonths(transaction, {
        validFrom: period.validFrom.toISOString().slice(0, 10),
        validUntil: period.validUntil?.toISOString().slice(0, 10),
        context: input.context,
        entityType: "CalculationPolicy",
        entityId: previous?.id ?? "new",
        action: "POLICY_CHANGE",
      });
    }
    const policy = previous
      ? await transaction.calculationPolicy.update({ where: { id: previous.id }, data: value })
      : await transaction.calculationPolicy.create({ data: value });
    await writeAuditLog(transaction, input.context, {
      action: previous ? "CALCULATION_POLICY_UPDATED" : "CALCULATION_POLICY_CREATED",
      entityType: "CalculationPolicy",
      entityId: policy.id,
      oldData: previous,
      newData: policy,
    });
    if (!previous || periods.length === 0) return { policy, affectedDays: [] as Array<{ employeeId: string; date: string }> };
    const employeeIds = [...new Set(periods.map((period) => period.employeeId))];
    const [summaries, punches] = await Promise.all([
      transaction.dailySummary.findMany({ where: { employeeId: { in: employeeIds } }, select: { employeeId: true, date: true } }),
      transaction.rawPunch.findMany({ where: { employeeDeviceLink: { employeeId: { in: employeeIds } } }, select: { occurredAt: true, employeeDeviceLink: { select: { employeeId: true } } } }),
    ]);
    const isInAffectedPeriod = (employeeId: string, date: string) => periods.some((period) => period.employeeId === employeeId && period.validFrom.toISOString().slice(0, 10) <= date && (!period.validUntil || period.validUntil.toISOString().slice(0, 10) >= date));
    const affectedDays = [
      ...summaries.map((summary) => ({ employeeId: summary.employeeId, date: summary.date.toISOString().slice(0, 10) })),
      ...punches.flatMap((punch) => punch.employeeDeviceLink ? [{ employeeId: punch.employeeDeviceLink.employeeId, date: toBusinessDate(punch.occurredAt) }] : []),
    ].filter((day) => isInAffectedPeriod(day.employeeId, day.date));
    return { policy, affectedDays };
  });
  const calculation = input.id
    ? await runCalculation({ trigger: "POLICY_CHANGE", startedById: input.context.userId, affectedDays: changed.affectedDays })
    : { calculationRunId: null, processedDays: 0, failedDays: 0, generatedInconsistencies: 0, autoResolved: 0 };
  return { ...changed.policy, calculation };
}
