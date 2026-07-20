import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { findMergeConflicts, type MergeEmployeeSnapshot } from "@/modules/employees/domain/relationships";
import { employeeMergeInputSchema } from "@/modules/employees/domain/validation";

function toDateKey(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

function toSnapshot(employee: {
  id: string;
  registration: string | null;
  cpf: string | null;
  scheduleAssignments: Array<{ id: string; validFrom: Date; validUntil: Date | null }>;
  deviceLinks: Array<{ id: string; deviceId: string; externalEmployeeNumber: string; validFrom: Date; validUntil: Date | null; active: boolean }>;
  dailySummaries: Array<{ date: Date }>;
  tagAssignments: Array<{ employeeTagId: string }>;
}): MergeEmployeeSnapshot {
  return {
    id: employee.id,
    registration: employee.registration,
    cpf: employee.cpf,
    scheduleAssignments: employee.scheduleAssignments.map((assignment) => ({ id: assignment.id, validFrom: assignment.validFrom.toISOString().slice(0, 10), validUntil: toDateKey(assignment.validUntil) })),
    deviceLinks: employee.deviceLinks.map((link) => ({ id: link.id, deviceId: link.deviceId, externalEmployeeNumber: link.externalEmployeeNumber, validFrom: link.validFrom.toISOString().slice(0, 10), validUntil: toDateKey(link.validUntil), active: link.active })),
    dailySummaryDates: employee.dailySummaries.map((summary) => summary.date.toISOString().slice(0, 10)),
    tagIds: employee.tagAssignments.map((assignment) => assignment.employeeTagId),
  };
}

const mergeInclude = {
  scheduleAssignments: { select: { id: true, validFrom: true, validUntil: true } },
  deviceLinks: { select: { id: true, deviceId: true, externalEmployeeNumber: true, validFrom: true, validUntil: true, active: true } },
  dailySummaries: { select: { date: true } },
  tagAssignments: { select: { employeeTagId: true } },
} as const;

export async function getEmployeeMergePreview(primaryEmployeeId: string, secondaryEmployeeId: string) {
  if (primaryEmployeeId === secondaryEmployeeId) throw new Error("Selecione cadastros diferentes para mesclar.");
  const prisma = getPrisma();
  const [primary, secondary] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: primaryEmployeeId }, include: mergeInclude }),
    prisma.employee.findUniqueOrThrow({ where: { id: secondaryEmployeeId }, include: mergeInclude }),
  ]);
  const conflicts = findMergeConflicts(toSnapshot(primary), toSnapshot(secondary));
  return {
    primary: { id: primary.id, fullName: primary.fullName, registration: primary.registration, provisional: primary.provisional },
    secondary: { id: secondary.id, fullName: secondary.fullName, registration: secondary.registration, provisional: secondary.provisional },
    conflicts,
    transfer: {
      deviceLinks: secondary.deviceLinks.length,
      scheduleAssignments: secondary.scheduleAssignments.length,
      dailySummaries: secondary.dailySummaries.length,
      tags: secondary.tagAssignments.length,
    },
  };
}

export async function mergeEmployees(input: unknown, context: AuditContext) {
  const parsed = employeeMergeInputSchema.parse(input);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const [primary, secondary] = await Promise.all([
      transaction.employee.findUniqueOrThrow({ where: { id: parsed.primaryEmployeeId }, include: mergeInclude }),
      transaction.employee.findUniqueOrThrow({ where: { id: parsed.secondaryEmployeeId }, include: mergeInclude }),
    ]);
    if (primary.status === "MERGED" || secondary.status === "MERGED") throw new Error("Não é possível mesclar um cadastro que já foi mesclado.");
    const conflicts = findMergeConflicts(toSnapshot(primary), toSnapshot(secondary));
    const blockers = conflicts.filter((conflict) => conflict.blocking);
    if (blockers.length > 0) throw new Error(`A mesclagem possui conflitos: ${blockers.map((conflict) => conflict.message).join(" ")}`);

    const primaryTagIds = new Set(primary.tagAssignments.map((assignment) => assignment.employeeTagId));
    const secondaryTagIds = secondary.tagAssignments.map((assignment) => assignment.employeeTagId);
    const tagsToMove = secondaryTagIds.filter((tagId) => !primaryTagIds.has(tagId));
    if (tagsToMove.length > 0) {
      await transaction.employeeTagAssignment.createMany({ data: tagsToMove.map((employeeTagId) => ({ employeeId: primary.id, employeeTagId })), skipDuplicates: true });
    }
    await transaction.employeeTagAssignment.deleteMany({ where: { employeeId: secondary.id } });

    const [links, schedules, summaries, inconsistencies, adjustments, exceptions] = await Promise.all([
      transaction.employeeDeviceLink.updateMany({ where: { employeeId: secondary.id }, data: { employeeId: primary.id } }),
      transaction.employeeScheduleAssignment.updateMany({ where: { employeeId: secondary.id }, data: { employeeId: primary.id } }),
      transaction.dailySummary.updateMany({ where: { employeeId: secondary.id }, data: { employeeId: primary.id } }),
      transaction.inconsistency.updateMany({ where: { employeeId: secondary.id }, data: { employeeId: primary.id } }),
      transaction.adjustment.updateMany({ where: { employeeId: secondary.id }, data: { employeeId: primary.id } }),
      transaction.calendarException.updateMany({ where: { employeeId: secondary.id }, data: { employeeId: primary.id } }),
    ]);
    const merged = await transaction.employee.update({ where: { id: secondary.id }, data: { status: "MERGED", mergedIntoId: primary.id } });
    await writeAuditLog(transaction, context, {
      action: "EMPLOYEE_MERGED",
      entityType: "Employee",
      entityId: merged.id,
      oldData: { primaryEmployeeId: primary.id, secondaryEmployeeId: secondary.id, secondaryStatus: secondary.status },
      newData: {
        mergedIntoId: primary.id,
        transferred: {
          deviceLinks: links.count,
          scheduleAssignments: schedules.count,
          dailySummaries: summaries.count,
          inconsistencies: inconsistencies.count,
          adjustments: adjustments.count,
          calendarExceptions: exceptions.count,
          tags: tagsToMove.length,
        },
        warnings: conflicts.filter((conflict) => !conflict.blocking).map((conflict) => conflict.code),
      },
      reason: parsed.reason,
    });
    return { primaryEmployeeId: primary.id, mergedEmployeeId: merged.id, conflicts };
  });
}
