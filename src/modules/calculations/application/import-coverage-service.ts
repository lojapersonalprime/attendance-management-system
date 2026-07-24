import "server-only";

import { addDays } from "date-fns";
import { getPrisma } from "@/lib/db/prisma";
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
  const prisma = getPrisma();
  const imported = await prisma.$transaction(async (transaction) => {
    await assertOpenCalculationMonths(transaction, {
      validFrom: value.coverageFrom,
      validUntil: value.coverageTo,
      context: input.context,
      entityType: "ImportFile",
      entityId: input.importFileId,
      action: "IMPORT_COVERAGE_CONFIRMED",
    });
    const previous = await transaction.importFile.findUniqueOrThrow({ where: { id: input.importFileId } });
    const importFile = await transaction.importFile.update({
      where: { id: input.importFileId },
      data: { coverageFrom: dateOnly(value.coverageFrom), coverageTo: dateOnly(value.coverageTo), coverageStatus: "CONFIRMED", coverageConfirmedById: input.context.userId, coverageConfirmedAt: new Date() },
    });
    const employeeLinks = await transaction.rawPunch.findMany({
      where: { importFileId: input.importFileId, employeeDeviceLinkId: { not: null } },
      select: { employeeDeviceLink: { select: { employeeId: true } } },
      distinct: ["employeeDeviceLinkId"],
    });
    const employeeIds = [...new Set(employeeLinks.flatMap((punch) => punch.employeeDeviceLink ? [punch.employeeDeviceLink.employeeId] : []))];
    await writeAuditLog(transaction, input.context, {
      action: "IMPORT_COVERAGE_CONFIRMED",
      entityType: "ImportFile",
      entityId: importFile.id,
      oldData: { coverageFrom: previous.coverageFrom, coverageTo: previous.coverageTo, coverageStatus: previous.coverageStatus },
      newData: { coverageFrom: value.coverageFrom, coverageTo: value.coverageTo, coverageStatus: "CONFIRMED", employeeCount: employeeIds.length },
      reason: value.reason,
    });
    return { employeeIds, importFile };
  });
  const affectedDays = datesInRange(value.coverageFrom, value.coverageTo).flatMap((date) => imported.employeeIds.map((employeeId) => ({ employeeId, date })));
  const calculation = await runCalculation({ trigger: "IMPORT_COVERAGE_CONFIRMED", importFileId: input.importFileId, startedById: input.context.userId, affectedDays });
  return { importFile: imported.importFile, calculation };
}
