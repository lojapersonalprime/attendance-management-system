import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowRight, MapPin } from "lucide-react";
import { MobilePunchRegister } from "@/components/mobile-attendance/mobile-punch-register";
import { getCalculatedTimeline } from "@/modules/attendance/domain/calculated-timeline";
import { punchPresentation } from "@/modules/attendance/domain/presentation";
import { getEmployeeMobilePortalData } from "@/modules/mobile-attendance/application/mobile-attendance-service";

export default async function EmployeePortalHomePage() {
  const { profile, access, today, punches, summary } = await getEmployeeMobilePortalData();
  const calculated = getCalculatedTimeline(summary?.calculationMemory, summary?.recordedMinutes ?? 0).punches.filter((punch) => punch.origin === "MOBILE_PUNCH");
  const calculatedById = new Map(calculated.map((punch) => [punch.id, punch]));
  const last = punches.at(-1);
  return <div className="space-y-4"><section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm"><p className="text-sm text-slate-300">Olá, {profile.name.split(" ")[0]}</p><h1 className="mt-1 text-2xl font-bold">{access.allowedUnit.name}</h1><p className="mt-4 text-sm text-slate-300">Hoje</p><p className="text-lg font-semibold">{formatInTimeZone(new Date(`${today}T12:00:00.000Z`), "America/Fortaleza", "dd 'de' MMMM 'de' yyyy")}</p><div className="mt-5 border-t border-white/15 pt-4"><p className="text-xs uppercase tracking-wide text-slate-400">Último registro</p><p className="mt-1 font-semibold">{last ? `${formatInTimeZone(last.registeredAt, "America/Fortaleza", "HH:mm")} — ${calculatedById.get(last.id) ? punchPresentation[calculatedById.get(last.id)!.punchCode].label : "Recebido"}` : "Nenhum registro hoje"}</p></div></section><div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"><MapPin size={17} aria-hidden="true" />A localização será conferida no momento do registro.</div><MobilePunchRegister privacyAccepted={Boolean(access.privacyAcceptedAt)} /><section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Registros de hoje</h2><p className="text-sm text-[var(--muted-foreground)]">A interpretação segue sua jornada.</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]" href={"/meu-ponto/registros" as Route}>Ver todos <ArrowRight size={15} /></Link></div>{punches.length === 0 ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--muted-foreground)]">Nenhum registro feito hoje.</p> : <ul className="mt-4 divide-y">{punches.map((punch) => { const interpreted = calculatedById.get(punch.id); return <li className="flex items-center justify-between py-3" key={punch.id}><span className="font-semibold">{formatInTimeZone(punch.registeredAt, "America/Fortaleza", "HH:mm")}</span><span className="text-sm text-[var(--muted-foreground)]">{interpreted ? punchPresentation[interpreted.punchCode].label : "Aguardando interpretação"}</span></li>; })}</ul>}</section></div>;
}
