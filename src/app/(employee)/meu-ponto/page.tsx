import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowRight } from "lucide-react";
import { MobilePunchRegister } from "@/components/mobile-attendance/mobile-punch-register";
import { BUSINESS_TIME_ZONE } from "@/lib/dates/business";
import { getCalculatedTimeline } from "@/modules/attendance/domain/calculated-timeline";
import { punchPresentation } from "@/modules/attendance/domain/presentation";
import { getEmployeeMobilePortalData } from "@/modules/mobile-attendance/application/mobile-attendance-service";

function greetingForServerTime(serverNow: Date) {
  const hour = Number(formatInTimeZone(serverNow, BUSINESS_TIME_ZONE, "H"));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function EmployeePortalHomePage() {
  const { access, serverNow, punches, summary } = await getEmployeeMobilePortalData();
  const calculated = getCalculatedTimeline(summary?.calculationMemory, summary?.recordedMinutes ?? 0).punches.filter((punch) => punch.origin === "MOBILE_PUNCH");
  const calculatedById = new Map(calculated.map((punch) => [punch.id, punch]));
  const last = punches.at(-1);
  const employeeName = access.employee.fullName;
  const firstName = employeeName.trim().split(/\s+/)[0] || employeeName;

  return <div className="space-y-4"><section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm"><p className="text-sm text-slate-300">Olá, {firstName}! {greetingForServerTime(serverNow)} 👋</p><h1 className="mt-3 text-2xl font-bold">Tudo pronto para registrar seu ponto?</h1><p className="mt-4 text-sm text-slate-300">Agora são</p><p className="text-2xl font-bold">{formatInTimeZone(serverNow, BUSINESS_TIME_ZONE, "HH:mm")}</p><p className="mt-4 text-sm font-semibold text-slate-200">{access.allowedUnit.name}</p><div className="mt-5 border-t border-white/15 pt-4"><p className="text-xs uppercase tracking-wide text-slate-400">Último registro</p><p className="mt-1 font-semibold">{last ? `Hoje, às ${formatInTimeZone(last.registeredAt, BUSINESS_TIME_ZONE, "HH:mm")}` : "Nenhum registro hoje"}</p></div><p className="mt-4 text-xs text-slate-400">{formatInTimeZone(serverNow, BUSINESS_TIME_ZONE, "dd 'de' MMMM 'de' yyyy")}</p></section><MobilePunchRegister employeeName={employeeName} privacyAccepted={Boolean(access.privacyAcceptedAt)} unitName={access.allowedUnit.name} /><section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Registros de hoje</h2><p className="text-sm text-[var(--muted-foreground)]">A interpretação segue sua jornada.</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]" href={"/meu-ponto/registros" as Route}>Ver todos <ArrowRight size={15} /></Link></div>{punches.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--muted-foreground)]">Nenhum registro feito hoje.</p> : <ul className="mt-4 divide-y">{punches.map((punch) => { const interpreted = calculatedById.get(punch.id); return <li className="flex items-center justify-between py-3" key={punch.id}><span className="font-semibold">{formatInTimeZone(punch.registeredAt, BUSINESS_TIME_ZONE, "HH:mm")}</span><span className="text-sm text-[var(--muted-foreground)]">{interpreted ? punchPresentation[interpreted.punchCode].label : "Aguardando interpretação"}</span></li>; })}</ul>}</section></div>;
}
