import Link from "next/link";
import { saveScheduleAction } from "@/app/(dashboard)/jornadas/actions";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleForm } from "@/components/schedules/schedule-form";
import { requireRhAdmin } from "@/modules/auth/server/session";

export default async function NewSchedulePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireRhAdmin();
  const query = await searchParams;
  return <><div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Nova jornada" description="Defina cada dia conforme contrato e política interna." /><Link className="rounded-md border px-4 py-2 text-sm font-semibold" href="/jornadas">Voltar</Link></div>{query.erro ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{query.erro}</p> : null}<section className="rounded-lg border bg-white p-5"><ScheduleForm action={saveScheduleAction} /></section></>;
}
