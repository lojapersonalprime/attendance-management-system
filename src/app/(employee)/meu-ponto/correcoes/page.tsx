import { formatInTimeZone } from "date-fns-tz";
import { CorrectionRequestForm } from "@/components/mobile-attendance/correction-request-form";
import { getEmployeeMobileRecords } from "@/modules/mobile-attendance/application/mobile-attendance-service";

const statusLabel = { OPEN: "Enviada", IN_REVIEW: "Em análise", APPROVED: "Aprovada", REJECTED: "Concluída" } as const;

export default async function EmployeeCorrectionsPage() {
  const { punches, corrections } = await getEmployeeMobileRecords();
  return <div className="space-y-6"><CorrectionRequestForm punches={punches.map((punch) => ({ id: punch.id, label: `${formatInTimeZone(punch.registeredAt, "America/Fortaleza", "dd/MM · HH:mm:ss")}` }))} /><section className="surface rounded-[1.5rem] p-5 sm:p-6"><p className="eyebrow text-[var(--primary)]">ACOMPANHAMENTO</p><h2 className="font-display mt-2 text-4xl font-semibold leading-none text-[var(--foreground)]">Minhas solicitações</h2>{corrections.length === 0 ? <p className="mt-5 text-sm text-[var(--muted-foreground)]">Nenhuma solicitação enviada.</p> : <ul className="mt-5 divide-y divide-[var(--border)]">{corrections.map((request) => <li className="py-4 first:pt-0" key={request.id}><div className="flex justify-between gap-3"><p className="font-display numeric text-3xl font-semibold leading-none text-[var(--foreground)]">{formatInTimeZone(request.businessDate, "UTC", "dd/MM/yyyy")}</p><span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">{statusLabel[request.status]}</span></div><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{request.description}</p></li>)}</ul>}</section></div>;
}
