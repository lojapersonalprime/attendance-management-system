import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { getActiveProfile } from "@/modules/auth/server/session";
import { createMonthlyAttendanceCsv } from "@/modules/reports/domain/csv";

export const runtime = "nodejs";

function monthRange(reference: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reference)) return undefined;
  const start = new Date(`${reference}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export async function GET(request: Request) {
  const profile = await getActiveProfile();
  if (!profile) return NextResponse.json({ error: "Você não possui um perfil ativo do RH." }, { status: 403 });
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  const range = monthRange(reference);
  if (!range) return NextResponse.json({ error: "Informe a competência no formato AAAA-MM." }, { status: 400 });

  const summaries = await getPrisma().dailySummary.findMany({
    where: { date: { gte: range.start, lt: range.end } },
    include: { employee: true },
    orderBy: [{ employee: { fullName: "asc" } }, { date: "asc" }],
  });
  const csv = createMonthlyAttendanceCsv(summaries.map((summary) => ({
    employee: summary.employee.fullName,
    registration: summary.employee.registration,
    date: summary.date,
    workedMinutes: summary.validWorkedMinutes,
    expectedMinutes: summary.expectedMinutes,
    balanceMinutes: summary.pendingExcessMinutes - summary.negativeMinutes,
    status: summary.status,
  })));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="apuracao-${reference}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
