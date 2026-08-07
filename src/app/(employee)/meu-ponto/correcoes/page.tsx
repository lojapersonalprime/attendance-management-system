import { formatInTimeZone } from "date-fns-tz";
import { CorrectionRequestForm } from "@/components/mobile-attendance/correction-request-form";
import { getEmployeeMobileRecords } from "@/modules/mobile-attendance/application/mobile-attendance-service";

const statusLabel = { OPEN: "Enviada", IN_REVIEW: "Em análise", APPROVED: "Aprovada", REJECTED: "Concluída" } as const;

export default async function EmployeeCorrectionsPage() {
  const { punches, corrections } = await getEmployeeMobileRecords();
  return <div className="space-y-5"><CorrectionRequestForm punches={punches.map((punch) => ({ id: punch.id, label: `${formatInTimeZone(punch.registeredAt, "America/Fortaleza", "dd/MM · HH:mm:ss")}` }))} /><section className="rounded-3xl border bg-white p-5 shadow-sm"><h2 className="font-bold">Minhas solicitações</h2>{corrections.length === 0 ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Nenhuma solicitação enviada.</p> : <ul className="mt-3 divide-y">{corrections.map((request) => <li className="py-3" key={request.id}><div className="flex justify-between gap-3"><p className="font-semibold">{formatInTimeZone(request.businessDate, "UTC", "dd/MM/yyyy")}</p><span className="text-sm text-[var(--muted-foreground)]">{statusLabel[request.status]}</span></div><p className="mt-1 text-sm text-slate-700">{request.description}</p></li>)}</ul>}</section></div>;
}
