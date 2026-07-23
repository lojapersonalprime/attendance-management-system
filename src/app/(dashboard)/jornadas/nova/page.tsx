import Link from "next/link";
import { saveScheduleAction } from "@/app/(dashboard)/jornadas/actions";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleForm } from "@/components/schedules/schedule-form";
import { getScheduleFormErrorMessage } from "@/lib/presentation/labels";
import { requireRhAdmin } from "@/modules/auth/server/session";

export default async function NewSchedulePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireRhAdmin();
  const query = await searchParams;
  const errorMessage = getScheduleFormErrorMessage(query.erro);
  return <><div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Novo modelo de horário" description="Defina os dias e horários que o RH poderá atribuir aos funcionários." /><Link className="rounded-md border px-4 py-2 text-sm font-semibold" href="/jornadas">Voltar</Link></div>{errorMessage ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{errorMessage}</p> : null}<ScheduleForm action={saveScheduleAction} /></>;
}
