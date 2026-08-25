import Link from "next/link";
import { notFound } from "next/navigation";
import { duplicateScheduleAction, removeScheduleAction, saveScheduleAction, toggleScheduleAction } from "@/app/(dashboard)/jornadas/actions";
import { ScheduleRemovalAction } from "@/components/schedules/schedule-removal-action";
import { PageHeader } from "@/components/layout/page-header";
import { formatBusinessDate } from "@/lib/dates/business";
import { employeeRoute } from "@/lib/routes";
import { ScheduleForm } from "@/components/schedules/schedule-form";
import { getScheduleFormErrorMessage } from "@/lib/presentation/labels";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { getScheduleTemplate } from "@/modules/schedules/application/queries";

function formatDate(value: Date) {
  return formatBusinessDate(value, "dd/MM/yyyy");
}

export default async function ScheduleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const [{ id }, profile, query] = await Promise.all([params, requireActiveProfile(), searchParams]);
  const schedule = await getScheduleTemplate(id);
  if (!schedule) notFound();
  const canManage = profile.role === "RH_ADMIN";
  const errorMessage = getScheduleFormErrorMessage(query.erro);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title={schedule.name} description={schedule.description ?? "Modelo de horário"} />
        <Link className="rounded-md border px-4 py-2 text-sm font-semibold" href="/jornadas">Voltar</Link>
      </div>
      {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
      {errorMessage ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}
      {canManage ? (
        <ScheduleForm action={saveScheduleAction} schedule={schedule} used={schedule._count.assignments > 0} />
      ) : <section className="rounded-lg border bg-white p-5"><p className="text-sm text-[var(--muted-foreground)]">Somente administradores de RH podem editar este modelo de horário.</p></section>}
      <section className="mt-5 rounded-lg border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Funcionários vinculados</h2><p className="text-sm text-[var(--muted-foreground)]">{schedule._count.assignments} vínculo(s) histórico(s).</p></div>
          {canManage ? <div className="flex gap-2">
            <form action={duplicateScheduleAction}><input type="hidden" name="id" value={schedule.id} /><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="submit">Duplicar</button></form>
            <form action={toggleScheduleAction} className="flex gap-2"><input type="hidden" name="id" value={schedule.id} /><input type="hidden" name="active" value={String(!schedule.active)} />{schedule.active ? <input className="input w-40" name="reason" placeholder="Motivo" /> : null}<button className="rounded-md border px-3 py-2 text-sm font-semibold" type="submit">{schedule.active ? "Inativar" : "Ativar"}</button></form><ScheduleRemovalAction action={removeScheduleAction} linkedEmployees={schedule.currentEmployeeCount} scheduleId={schedule.id} scheduleName={schedule.name} />
          </div> : null}
        </div>
        {schedule.assignments.length === 0 ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Nenhum vínculo para exibir.</p> : <ul className="mt-4 divide-y">{schedule.assignments.map((assignment) => (
          <li className="flex flex-wrap justify-between gap-2 py-3 text-sm" key={assignment.id}>
            <Link className="font-semibold text-[var(--primary)] hover:underline" href={employeeRoute(assignment.employee.id)}>{assignment.employee.fullName}{assignment.employee.provisional ? " · provisório" : ""}</Link>
            <span>{formatDate(assignment.validFrom)} até {assignment.validUntil ? formatDate(assignment.validUntil) : "vigente"}</span>
          </li>
        ))}</ul>}
      </section>
    </>
  );
}
