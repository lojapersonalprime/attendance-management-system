import { PageHeader } from "@/components/layout/page-header";
import { getPrisma } from "@/lib/db/prisma";

export default async function SchedulesPage() {
  const schedules = await getPrisma().scheduleTemplate.findMany({
    include: { days: { orderBy: { weekday: "asc" } }, _count: { select: { assignments: true } } },
    orderBy: { name: "asc" },
  });
  return <><PageHeader title="Jornadas" description="Modelos de horário e vínculos com vigência histórica." />{schedules.length === 0 ? <p className="rounded-lg border bg-white p-6 text-sm text-[var(--muted-foreground)]">Nenhuma jornada cadastrada. A aplicação não define jornadas a partir das marcações.</p> : <div className="grid gap-4 md:grid-cols-2">{schedules.map((schedule) => <article className="rounded-lg border bg-white p-5" key={schedule.id}><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{schedule.name}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{schedule.description ?? "Sem descrição"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{schedule.active ? "Ativa" : "Inativa"}</span></div><p className="mt-4 text-sm">{schedule._count.assignments} vínculo(s) histórico(s)</p><ul className="mt-3 space-y-1 text-sm text-[var(--muted-foreground)]">{schedule.days.map((day) => <li key={day.id}>Dia {day.weekday}: {day.isWorkingDay ? `${day.expectedMinutes} min previstos` : "folga"}</li>)}</ul></article>)}</div>}</>;
}
