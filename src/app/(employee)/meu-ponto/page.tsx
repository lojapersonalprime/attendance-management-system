import Link from "next/link";
import type { Route } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowUpRight } from "lucide-react";
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
  const now = formatInTimeZone(serverNow, BUSINESS_TIME_ZONE, "HH:mm");

  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)] lg:items-stretch"><section className="surface-highlight relative overflow-hidden rounded-[2rem] p-6 sm:p-8"><div aria-hidden="true" className="absolute right-0 top-0 h-36 w-36 rounded-bl-full border-b border-l border-[rgb(244_122_32_/_28%)]" /><div className="relative"><p className="eyebrow text-[var(--primary)]">{greetingForServerTime(serverNow)}, {firstName}</p><h1 className="font-display mt-4 max-w-md text-5xl font-semibold leading-[0.88] text-[var(--foreground)] sm:text-6xl">Tudo pronto para registrar seu ponto?</h1><div className="mt-9"><p className="eyebrow text-[var(--muted-foreground)]">AGORA SÃO</p><p className="font-display numeric mt-1 text-[clamp(6.8rem,19vw,11rem)] font-semibold leading-[0.72] text-[var(--foreground)]">{now}</p></div><div className="mt-10 grid gap-5 border-t border-[var(--border)] pt-5 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="eyebrow text-[var(--muted-foreground)]">UNIDADE</p><p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{access.allowedUnit.name}</p></div><div className="rounded-2xl border border-[var(--border)] bg-[rgb(11_11_13_/_36%)] px-4 py-3 sm:min-w-52"><p className="eyebrow text-[var(--muted-foreground)]">ÚLTIMO REGISTRO</p><p className="numeric mt-2 text-sm font-semibold text-[var(--foreground)]">{last ? `Hoje, ${formatInTimeZone(last.registeredAt, BUSINESS_TIME_ZONE, "HH:mm")}` : "Nenhum registro hoje"}</p></div></div><p className="mt-5 text-xs text-[var(--muted-foreground)]">{formatInTimeZone(serverNow, BUSINESS_TIME_ZONE, "dd 'de' MMMM 'de' yyyy")}</p></div></section><MobilePunchRegister employeeName={employeeName} privacyAccepted={Boolean(access.privacyAcceptedAt)} unitName={access.allowedUnit.name} /></div><section className="surface rounded-[2rem] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow text-[var(--primary)]">HOJE</p><h2 className="font-display mt-2 text-4xl font-semibold leading-none text-[var(--foreground)]">Registros de hoje</h2><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">A interpretação segue sua jornada vigente.</p></div><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]" href={"/meu-ponto/registros" as Route}>Ver todos <ArrowUpRight aria-hidden="true" size={17} /></Link></div>{punches.length === 0 ? <p className="surface-elevated mt-6 rounded-2xl p-4 text-sm text-[var(--muted-foreground)]">Nenhum registro feito hoje.</p> : <ul className="mt-6 divide-y divide-[var(--border)]">{punches.map((punch) => { const interpreted = calculatedById.get(punch.id); return <li className="grid grid-cols-[5rem_1fr] items-center gap-4 py-4 first:pt-0" key={punch.id}><span className="font-display numeric text-4xl font-semibold leading-none text-[var(--foreground)]">{formatInTimeZone(punch.registeredAt, BUSINESS_TIME_ZONE, "HH:mm")}</span><span className="border-l border-[var(--border)] pl-4 text-sm text-[var(--muted-foreground)]">{interpreted ? punchPresentation[interpreted.punchCode].label : "Aguardando interpretação"}</span></li>; })}</ul>}</section></div>;
}
