import "server-only";

import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE, formatMinutes } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";

export interface DashboardData {
  latestImportLabel: string;
  latestImportHint: string;
  employeeCount: number;
  provisionalEmployeeCount: number;
  openInconsistencyCount: number;
  regularDayCount: number;
  positiveMinutes: number;
  negativeMinutes: number;
  importedFileCount: number;
  currentPeriodStatus: string;
}

function currentReferenceMonth() {
  const reference = formatInTimeZone(new Date(), BUSINESS_TIME_ZONE, "yyyy-MM");
  return new Date(`${reference}-01T00:00:00.000Z`);
}

export async function getDashboardData(): Promise<DashboardData> {
  const prisma = getPrisma();
  const referenceMonth = currentReferenceMonth();
  const nextMonth = new Date(Date.UTC(referenceMonth.getUTCFullYear(), referenceMonth.getUTCMonth() + 1, 1));

  const [latestImport, employeeCount, provisionalEmployeeCount, openInconsistencyCount, regularDayCount, balances, importedFileCount, closing] =
    await Promise.all([
      prisma.importFile.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { finishedAt: "desc" },
        select: { originalFilename: true, finishedAt: true, acceptedRows: true, duplicatedRows: true },
      }),
      prisma.employee.count(),
      prisma.employee.count({ where: { provisional: true } }),
      prisma.inconsistency.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
      prisma.dailySummary.count({
        where: { date: { gte: referenceMonth, lt: nextMonth }, status: "REGULAR" },
      }),
      prisma.dailySummary.aggregate({
        where: { date: { gte: referenceMonth, lt: nextMonth } },
        _sum: { positiveMinutes: true, negativeMinutes: true },
      }),
      prisma.importFile.count({ where: { status: "COMPLETED" } }),
      prisma.closingPeriod.findUnique({ where: { referenceMonth } }),
    ]);

  return {
    latestImportLabel: latestImport ? latestImport.originalFilename : "Nenhuma importação",
    latestImportHint: latestImport?.finishedAt
      ? `Concluída em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: BUSINESS_TIME_ZONE }).format(latestImport.finishedAt)}`
      : "Importe um TXT para iniciar",
    employeeCount,
    provisionalEmployeeCount,
    openInconsistencyCount,
    regularDayCount,
    positiveMinutes: balances._sum.positiveMinutes ?? 0,
    negativeMinutes: balances._sum.negativeMinutes ?? 0,
    importedFileCount,
    currentPeriodStatus: closing?.status === "CLOSED" ? "Fechada" : "Aberta",
  };
}

export function formatDashboardMinutes(value: number) {
  return formatMinutes(value);
}
