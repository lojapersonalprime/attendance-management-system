import "server-only";

import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE, formatBusinessDate, formatMinutes } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { getLastImportedAttendanceState } from "@/modules/attendance/domain/presentation";

export interface DashboardData {
  reference: string;
  referenceLabel: string;
  workedMinutes: number;
  negativeMinutes: number;
  pendingExcessMinutes: number;
  openPendingCount: number;
  criticalPendingCount: number;
  employeesWithAvailableCalculation: number;
  employeesMissingSchedule: number;
  latestImport: { label: string; hint: string; acceptedRows: number } | null;
  latestImportSituation: {
    importedAt: Date | null;
    ended: number;
    incomplete: number;
    onBreak: number;
    withoutRecord: number;
    employees: Array<{ id: string; name: string; occurredAt: Date; state: string; description: string; needsAction: boolean }>;
  } | null;
  dailyHours: Array<{ day: string; minutes: number }>;
  pendingCategories: Array<{ label: string; count: number }>;
  attentionEmployees: Array<{ id: string; name: string; negativeMinutes: number; criticalPendingCount: number }>;
  recommendations: Array<{ title: string; description: string; href: "/importacoes" | "/inconsistencias" | "/funcionarios" | "/jornadas" | "/apuracao" }>;
}

function referenceMonth(value?: string) {
  const fallback = formatInTimeZone(new Date(), BUSINESS_TIME_ZONE, "yyyy-MM");
  const reference = /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "") ? value! : fallback;
  const start = new Date(`${reference}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { reference, start, end };
}

function pendingCategory(type: string) {
  if (["MISSING_SCHEDULE", "OVERLAPPING_SCHEDULE"].includes(type)) return "Jornada";
  if (["MISSING_EMPLOYMENT_PERIOD", "OVERLAPPING_EMPLOYMENT_PERIOD", "MISSING_CALCULATION_POLICY"].includes(type)) return "Vínculo";
  if (["MISSING_ENTRY", "MISSING_EXIT", "MISSING_BREAK_OUT", "MISSING_BREAK_RETURN", "ODD_PUNCH_COUNT", "INVALID_SEQUENCE", "POSSIBLE_DUPLICATE", "INCOMPLETE_DAY"].includes(type)) return "Marcações";
  if (["LATE_ARRIVAL", "EARLY_DEPARTURE", "INTERVAL_TOO_SHORT", "INTERVAL_TOO_LONG"].includes(type)) return "Horários";
  if (type === "EXCESS_TIME_PENDING") return "Aprovações";
  if (["UNKNOWN_EMPLOYEE", "PROVISIONAL_EMPLOYEE"].includes(type)) return "Cadastro";
  return "Outros";
}

function displayReference(reference: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: BUSINESS_TIME_ZONE }).format(new Date(`${reference}-01T12:00:00.000Z`));
}

export async function getDashboardData(referenceInput?: string): Promise<DashboardData> {
  const prisma = getPrisma();
  const { reference, start, end } = referenceMonth(referenceInput);
  const openStatuses = ["OPEN", "IN_REVIEW", "REOPENED"] as const;
  const [latestImport, summaries, pendencies, missingScheduleRows, coveragePending, employees] = await Promise.all([
    prisma.importFile.findFirst({ where: { status: "COMPLETED" }, orderBy: { finishedAt: "desc" }, select: { id: true, originalFilename: true, finishedAt: true, acceptedRows: true, duplicatedRows: true } }),
    prisma.dailySummary.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, employeeId: true, workedMinutes: true, negativeMinutes: true, pendingExcessMinutes: true, scheduleAssignmentId: true, status: true, employee: { select: { fullName: true } }, inconsistencies: { where: { status: { in: [...openStatuses] } }, select: { severity: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.inconsistency.findMany({ where: { date: { gte: start, lt: end }, status: { in: [...openStatuses] } }, select: { type: true, severity: true } }),
    prisma.dailySummary.findMany({ where: { date: { gte: start, lt: end }, scheduleAssignmentId: null }, distinct: ["employeeId"], select: { employeeId: true } }),
    prisma.importFile.count({ where: { coverageStatus: "SUGGESTED", status: "COMPLETED" } }),
    prisma.employee.findMany({ where: { status: { not: "MERGED" } }, select: { id: true, fullName: true } }),
  ]);
  const latestPunches = latestImport ? await prisma.rawPunch.findMany({
    where: { importFileId: latestImport.id, employeeDeviceLinkId: { not: null } },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true, punchCode: true, employeeDeviceLink: { select: { employee: { select: { id: true, fullName: true } } } } },
  }) : [];
  const byDay = new Map<string, { minutes: number }>();
  const attention = new Map<string, { id: string; name: string; negativeMinutes: number; criticalPendingCount: number }>();
  for (const summary of summaries) {
    const day = formatBusinessDate(summary.date, "dd");
    const currentDay = byDay.get(day) ?? { minutes: 0 };
    currentDay.minutes += summary.workedMinutes;
    byDay.set(day, currentDay);
    const currentEmployee = attention.get(summary.employeeId) ?? { id: summary.employeeId, name: summary.employee.fullName, negativeMinutes: 0, criticalPendingCount: 0 };
    currentEmployee.negativeMinutes += summary.negativeMinutes;
    currentEmployee.criticalPendingCount += summary.inconsistencies.filter((item) => item.severity === "CRITICAL").length;
    attention.set(summary.employeeId, currentEmployee);
  }
  const categories = new Map<string, number>();
  let criticalPendingCount = 0;
  for (const pending of pendencies) {
    categories.set(pendingCategory(pending.type), (categories.get(pendingCategory(pending.type)) ?? 0) + 1);
    if (pending.severity === "CRITICAL") criticalPendingCount += 1;
  }
  const dailyHours = [...byDay.entries()].map(([day, values]) => ({ day, minutes: values.minutes }));
  const workedMinutes = summaries.reduce((total, item) => total + item.workedMinutes, 0);
  const negativeMinutes = summaries.reduce((total, item) => total + item.negativeMinutes, 0);
  const pendingExcessMinutes = summaries.reduce((total, item) => total + item.pendingExcessMinutes, 0);
  const employeesWithAvailableCalculation = new Set(summaries.filter((item) => item.status !== "PROVISIONAL").map((item) => item.employeeId)).size;
  const attentionEmployees = [...attention.values()]
    .filter((item) => item.negativeMinutes > 0 || item.criticalPendingCount > 0)
    .sort((left, right) => right.criticalPendingCount - left.criticalPendingCount || right.negativeMinutes - left.negativeMinutes)
    .slice(0, 10);
  const recommendations: DashboardData["recommendations"] = [];
  if (coveragePending > 0) recommendations.push({ title: "Confirmar período do arquivo", description: `${coveragePending} arquivo(s) aguardam confirmação de período antes do cálculo completo.`, href: "/importacoes" });
  if (missingScheduleRows.length > 0) recommendations.push({ title: "Configurar jornadas", description: `${missingScheduleRows.length} funcionário(s) têm dias aguardando jornada.`, href: "/funcionarios" });
  if (criticalPendingCount > 0) recommendations.push({ title: "Resolver pendências críticas", description: `${criticalPendingCount} pendência(s) críticas devem ser revisadas antes do fechamento.`, href: "/inconsistencias" });
  if (pendingExcessMinutes > 0) recommendations.push({ title: "Validar tempos excedentes", description: `${formatMinutes(pendingExcessMinutes)} aguardam aprovação conforme a política aplicável.`, href: "/apuracao" });
  if (recommendations.length === 0) recommendations.push({ title: "Revisar apuração mensal", description: "A competência não possui ações prioritárias abertas.", href: "/apuracao" });
  const lastPunchByEmployee = new Map<string, { occurredAt: Date; punchCode: "S" | "E" | "A" | "F"; name: string }>();
  for (const punch of latestPunches) {
    const employee = punch.employeeDeviceLink?.employee;
    if (employee && !lastPunchByEmployee.has(employee.id)) lastPunchByEmployee.set(employee.id, { occurredAt: punch.occurredAt, punchCode: punch.punchCode, name: employee.fullName });
  }
  const latestItems = [...lastPunchByEmployee.entries()].map(([id, punch]) => {
    const state = getLastImportedAttendanceState([punch]);
    return { id, name: punch.name, occurredAt: punch.occurredAt, state: state.label, description: state.description, needsAction: punch.punchCode !== "F" };
  }).sort((left, right) => Number(right.needsAction) - Number(left.needsAction) || right.occurredAt.getTime() - left.occurredAt.getTime());
  const latestImportSituation = latestImport ? {
    importedAt: latestImport.finishedAt,
    ended: latestItems.filter((item) => item.state === "Jornada encerrada").length,
    incomplete: latestItems.filter((item) => item.needsAction && item.state !== "Em intervalo").length,
    onBreak: latestItems.filter((item) => item.state === "Em intervalo").length,
    withoutRecord: Math.max(0, employees.length - latestItems.length),
    employees: latestItems.slice(0, 10),
  } : null;
  return {
    reference,
    referenceLabel: displayReference(reference),
    workedMinutes,
    negativeMinutes,
    pendingExcessMinutes,
    openPendingCount: pendencies.length,
    criticalPendingCount,
    employeesWithAvailableCalculation,
    employeesMissingSchedule: missingScheduleRows.length,
    latestImport: latestImport ? { label: latestImport.originalFilename, hint: latestImport.finishedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: BUSINESS_TIME_ZONE }).format(latestImport.finishedAt) : "Processamento concluído", acceptedRows: latestImport.acceptedRows - latestImport.duplicatedRows } : null,
    latestImportSituation,
    dailyHours,
    pendingCategories: [...categories.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count),
    attentionEmployees,
    recommendations,
  };
}

export function formatDashboardMinutes(value: number) { return formatMinutes(value); }
