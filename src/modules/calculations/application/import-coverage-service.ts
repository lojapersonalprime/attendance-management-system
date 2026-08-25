import "server-only";

import { addDays } from "date-fns";
import { getPrisma } from "@/lib/db/prisma";
import { operationalDateRange } from "@/modules/attendance/domain/operational-period";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { runCalculation } from "@/modules/calculations/application/calculation-run-service";
import { assertOpenCalculationMonths } from "@/modules/calculations/application/closed-period-guard";
import { importCoverageInputSchema } from "@/modules/calculations/domain/validation";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function datesInRange(from: string, to: string) {
  const result: string[] = [];
  for (let current = dateOnly(from); current <= dateOnly(to); current = addDays(current, 1)) {
    result.push(current.toISOString().slice(0, 10));
    if (result.length > 370) throw new Error("Confirme a cobertura em períodos de até 370 dias por vez.");
  }
  return result;
}

/** Confirms or corrects TXT coverage and recalculates only employees present in that file. */
export async function confirmImportCoverage(input: { importFileId: string; value: unknown; context: AuditContext }) {
  const value = importCoverageInputSchema.parse(input.value);
  const operationalCoverage = operationalDateRange(value.coverageFrom, value.coverageTo);
  if (!operationalCoverage) throw new Error("A cobertura informada termina antes do início da operação em 01/07/2026.");
  const prisma = getPrisma();
  const imported = await prisma.$transaction(async (transaction) => {
    await assertOpenCalculationMonths(transaction, {
      validFrom: operationalCoverage.validFrom,
      validUntil: operationalCoverage.validUntil,
      context: input.context,
      entityType: "ImportFile",
      entityId: input.importFileId,
      action: "IMPORT_COVERAGE_CONFIRMED",
    });
    const previous = await transaction.importFile.findUniqueOrThrow({ where: { id: input.importFileId } });
    const importFile = await transaction.importFile.update({
      where: { id: input.importFileId },
      data: { coverageFrom: dateOnly(operationalCoverage.validFrom), coverageTo: dateOnly(operationalCoverage.validUntil), coverageStatus: "CONFIRMED", coverageConfirmedById: input.context.userId, coverageConfirmedAt: new Date() },
    });
    const employeeLinks = await transaction.rawPunch.findMany({
      where: { importFileId: input.importFileId, employeeDeviceLinkId: { not: null }, occurredAt: { gte: dateOnly(operationalCoverage.validFrom) } },
      select: { employeeDeviceLink: { select: { employeeId: true } } },
      distinct: ["employeeDeviceLinkId"],
    });
    const employeeIds = [...new Set(employeeLinks.flatMap((punch) => punch.employeeDeviceLink ? [punch.employeeDeviceLink.employeeId] : []))];
    await writeAuditLog(transaction, input.context, {
      action: "IMPORT_COVERAGE_CONFIRMED",
      entityType: "ImportFile",
      entityId: importFile.id,
      oldData: { coverageFrom: previous.coverageFrom, coverageTo: previous.coverageTo, coverageStatus: previous.coverageStatus },
      newData: { coverageFrom: operationalCoverage.validFrom, coverageTo: operationalCoverage.validUntil, coverageStatus: "CONFIRMED", employeeCount: employeeIds.length },
      reason: value.reason,
    });
    return { employeeIds, importFile };
  });
  const affectedDays = datesInRange(operationalCoverage.validFrom, operationalCoverage.validUntil).flatMap((date) => imported.employeeIds.map((employeeId) => ({ employeeId, date })));
  const calculation = await runCalculation({ trigger: "IMPORT_COVERAGE_CONFIRMED", importFileId: input.importFileId, startedById: input.context.userId, affectedDays });
  return { importFile: imported.importFile, calculation };
}
