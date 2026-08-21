import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { PageHeader } from "@/components/layout/page-header";
import { getPrisma } from "@/lib/db/prisma";
import { addBusinessDateDays, businessDateTimeToUtc, toBusinessDate } from "@/lib/dates/business";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { getCalculatedTimeline } from "@/modules/attendance/domain/calculated-timeline";
import { punchPresentation } from "@/modules/attendance/domain/presentation";

export default async function UnitTodayPage({ searchParams }: { searchParams: Promise<{ unitId?: string }> }) {
  const [profile, query] = await Promise.all([requireActiveProfile(), searchParams]);
  const prisma = getPrisma();
  const units = await prisma.unit.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const selectedUnitId = units.some((unit) => unit.id === query.unitId)
    ? query.unitId!
    : units.find((unit) => unit.name.toLocaleLowerCase("pt-BR").includes("golden"))?.id ?? units[0]?.id;
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const today = toBusinessDate(new Date());
  const [rangeStart, rangeEnd, date] = [businessDateTimeToUtc(`${today} 00:00:00`), businessDateTimeToUtc(`${addBusinessDateDays(today, 1)} 00:00:00`), new Date(`${today}T00:00:00.000Z`)];
  const employees = selectedUnitId ? await prisma.employee.findMany({
    where: { unitId: selectedUnitId, status: "ACTIVE", provisional: false },
    orderBy: { fullName: "asc" },
    include: {
      dailySummaries: { where: { date }, take: 1 },
      mobilePunches: { where: { registeredAt: { gte: rangeStart, lt: rangeEnd } }, orderBy: { registeredAt: "desc" }, take: 1 },
      deviceLinks: { include: { rawPunches: { where: { occurredAt: { gte: rangeStart, lt: rangeEnd } }, orderBy: { occurredAt: "desc" }, take: 1 } } },
    },
  }) : [];
  const canView = profile.role !== "EMPLOYEE";
  return <><PageHeader eyebrow="VISÃO OPERACIONAL" title={`${selectedUnit?.name ?? "Unidade"} — Hoje`} description="Situação com base na última batida registrada; não representa localização atual." />{canView ? <form className="admin-filter-panel mb-5 flex max-w-md gap-2 rounded-[1.25rem] p-3"><select className="input" defaultValue={selectedUnitId ?? ""} name="unitId" onChange={undefined}><option value="">Selecione uma unidade</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold" type="submit">Ver</button></form> : null}<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{employees.map((employee) => { const summary = employee.dailySummaries[0]; const timeline = getCalculatedTimeline(summary?.calculationMemory, summary?.recordedMinutes ?? 0).punches; const last = timeline.at(-1); const uncalculated = employee.mobilePunches[0] ?? employee.deviceLinks.flatMap((link) => link.rawPunches)[0]; const description = last ? `${punchPresentation[last.punchCode].state} desde ${formatInTimeZone(last.occurredAt, "America/Fortaleza", "HH:mm")}` : uncalculated ? `Batida registrada às ${formatInTimeZone("registeredAt" in uncalculated ? uncalculated.registeredAt : uncalculated.occurredAt, "America/Fortaleza", "HH:mm")}; aguardando apuração` : "Ainda sem registro hoje"; return <article className="surface rounded-[1.35rem] p-5" key={employee.id}><p className="eyebrow text-[var(--primary)]">HOJE</p><h2 className="font-display mt-1 text-3xl font-semibold leading-none">{employee.fullName}</h2><p className="mt-3 text-sm text-[var(--muted-foreground)]">{description}</p>{summary ? <Link className="mt-5 inline-flex text-sm font-semibold text-[var(--primary)]" href={`/apuracao/${summary.id}`}>Ver registro do ponto →</Link> : null}</article>; })}{employees.length === 0 ? <p className="surface rounded-[1.35rem] p-5 text-sm text-[var(--muted-foreground)]">Não há funcionários ativos nesta unidade.</p> : null}</section></>;
}
