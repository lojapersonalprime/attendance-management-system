import { formatInTimeZone } from "date-fns-tz";
import { getEmployeeMobileRecords } from "@/modules/mobile-attendance/application/mobile-attendance-service";

export default async function EmployeeReceiptsPage() {
  const { access, punches } = await getEmployeeMobileRecords();
  return <div><h1 className="text-2xl font-bold">Meus comprovantes</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Comprovantes internos auditáveis do piloto de ponto pelo celular.</p><div className="mt-5 space-y-3">{punches.length === 0 ? <p className="rounded-3xl border bg-white p-5 text-sm text-[var(--muted-foreground)]">Nenhum comprovante disponível.</p> : punches.map((punch) => <article className="rounded-3xl border bg-white p-5 shadow-sm" key={punch.id}><p className="font-bold">{formatInTimeZone(punch.registeredAt, "America/Fortaleza", "dd/MM/yyyy · HH:mm:ss")}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{access.allowedUnit.name}</p><p className="mt-4 rounded-xl bg-slate-50 p-3 font-mono text-sm">Código: {punch.receiptCode}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">{punch.locationStatus === "INSIDE_RADIUS" ? "Localização confirmada" : "Registro disponível para revisão de localização"}</p></article>)}</div></div>;
}
