"use client";

import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { LoadingButton } from "@/components/ui/async-feedback";

export interface CalculationPolicyEditorValue {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  requiresSchedule: boolean;
  calculateLateArrival: boolean;
  calculateEarlyDeparture: boolean;
  calculateAbsence: boolean;
  calculateNegativeBalance: boolean;
  calculateExcessTime: boolean;
  excessRequiresApproval: boolean;
  requiresBreak: boolean;
  shortBreakGeneratesCredit: boolean;
  longBreakGeneratesDebit: boolean;
  allowAutomaticPositiveBalance: boolean;
  attendanceOnly: boolean;
  flexibleSchedule: boolean;
  duplicateWindowMinutes: number;
  entryToleranceMinutes: number;
  exitToleranceMinutes: number;
  breakToleranceMinutes: number;
  toleranceMode: "EXCESS_ONLY" | "FULL_EVENT" | "IGNORE_WITHIN_TOLERANCE";
  entryToleranceMode: "FULL_DELAY_AFTER_TOLERANCE" | "EXCESS_ONLY_AFTER_TOLERANCE";
}

function HiddenBoolean({ name, value }: { name: string; value: boolean }) {
  return value ? <input name={name} type="hidden" value="on" /> : null;
}

export function CalculationPolicyEditor({ policy, action }: { policy: CalculationPolicyEditorValue; action: (formData: FormData) => void | Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entryTolerance, setEntryTolerance] = useState(policy.entryToleranceMinutes);
  const [entryMode, setEntryMode] = useState(policy.entryToleranceMode);
  const [exitTolerance, setExitTolerance] = useState(policy.exitToleranceMinutes);
  const afterTolerance = entryMode === "FULL_DELAY_AFTER_TOLERANCE" ? "08:11 gera 11 minutos de atraso." : "08:11 gera 1 minuto de atraso.";

  return <><button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold hover:border-orange-300 hover:text-[var(--primary)]" onClick={() => dialog.current?.showModal()} type="button"><Pencil size={15} aria-hidden="true" />Editar regra</button><dialog aria-labelledby={`policy-${policy.id}`} className="m-auto w-[min(96vw,720px)] rounded-xl border p-0 shadow-2xl backdrop:bg-slate-950/40" ref={dialog}><form action={action} className="grid max-h-[90vh] gap-6 overflow-y-auto p-5"><input name="policyId" type="hidden" value={policy.id} /><input name="returnTo" type="hidden" value="/configuracoes/regras" /><HiddenBoolean name="calculateAbsence" value={policy.calculateAbsence} /><HiddenBoolean name="calculateNegativeBalance" value={policy.calculateNegativeBalance} /><HiddenBoolean name="requiresBreak" value={policy.requiresBreak} /><HiddenBoolean name="shortBreakGeneratesCredit" value={policy.shortBreakGeneratesCredit} /><HiddenBoolean name="longBreakGeneratesDebit" value={policy.longBreakGeneratesDebit} /><HiddenBoolean name="allowAutomaticPositiveBalance" value={policy.allowAutomaticPositiveBalance} /><HiddenBoolean name="attendanceOnly" value={policy.attendanceOnly} /><HiddenBoolean name="flexibleSchedule" value={policy.flexibleSchedule} /><input name="duplicateWindowMinutes" type="hidden" value={policy.duplicateWindowMinutes} /><input name="breakToleranceMinutes" type="hidden" value={policy.breakToleranceMinutes} />
    <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Regras de cálculo</p><h2 className="mt-1 text-lg font-semibold" id={`policy-${policy.id}`}>Editar {policy.name}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">A regra é aplicada pelo motor de cálculo; as marcações do relógio permanecem originais.</p></div>
    <fieldset className="grid gap-4 rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Informações gerais</legend><label className="grid gap-1 text-sm font-medium">Nome<input className="input" defaultValue={policy.name} name="name" required /></label><label className="grid gap-1 text-sm font-medium">Descrição<textarea className="input min-h-20" defaultValue={policy.description ?? ""} name="description" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium"><input defaultChecked={policy.active} name="active" type="checkbox" />Regra ativa</label><label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium"><input defaultChecked={policy.requiresSchedule} name="requiresSchedule" type="checkbox" />Exige modelo de horário</label></div></fieldset>
    <fieldset className="grid gap-4 rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Entrada</legend><label className="grid gap-1 text-sm font-medium">Tolerância de entrada (minutos)<input className="input" min="0" onChange={(event) => setEntryTolerance(Number(event.target.value) || 0)} type="number" value={entryTolerance} name="entryToleranceMinutes" /></label><label className="flex items-center gap-2 text-sm"><input defaultChecked={policy.calculateLateArrival} name="calculateLateArrival" type="checkbox" />Considerar atraso de entrada</label><label className="grid gap-1 text-sm font-medium">Quando ultrapassar a tolerância<select className="input" name="entryToleranceMode" onChange={(event) => setEntryMode(event.target.value as typeof entryMode)} value={entryMode}><option value="FULL_DELAY_AFTER_TOLERANCE">Considerar todo o atraso</option><option value="EXCESS_ONLY_AFTER_TOLERANCE">Considerar somente os minutos excedentes</option></select></label></fieldset>
    <fieldset className="grid gap-4 rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Saída</legend><label className="grid gap-1 text-sm font-medium">Tolerância de saída (minutos)<input className="input" min="0" onChange={(event) => setExitTolerance(Number(event.target.value) || 0)} type="number" value={exitTolerance} name="exitToleranceMinutes" /></label><label className="flex items-center gap-2 text-sm"><input defaultChecked={policy.calculateEarlyDeparture} name="calculateEarlyDeparture" type="checkbox" />Considerar saída antecipada</label><label className="grid gap-1 text-sm font-medium">Comportamento para saída antecipada<select className="input" defaultValue={policy.toleranceMode} name="toleranceMode"><option value="FULL_EVENT">Considerar todo o tempo fora da tolerância</option><option value="EXCESS_ONLY">Considerar somente os minutos excedentes</option><option value="IGNORE_WITHIN_TOLERANCE">Ignorar eventos dentro da tolerância</option></select></label></fieldset>
    <fieldset className="grid gap-4 rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Excedentes</legend><label className="flex items-center gap-2 text-sm"><input defaultChecked={policy.calculateExcessTime} name="calculateExcessTime" type="checkbox" />Identificar tempo excedente</label><label className="flex items-center gap-2 text-sm"><input defaultChecked={policy.excessRequiresApproval} name="excessRequiresApproval" type="checkbox" />Exigir aprovação do RH</label></fieldset>
    <section className="rounded-xl bg-orange-50 p-4 text-sm text-orange-950"><p className="font-semibold">Resumo antes de salvar</p><dl className="mt-3 grid gap-2 sm:grid-cols-2"><div><dt className="text-orange-800">Entrada prevista</dt><dd>08:00</dd></div><div><dt className="text-orange-800">Tolerância</dt><dd>{entryTolerance} minutos</dd></div></dl><p className="mt-3">08:03 {entryTolerance >= 3 ? "não gera desconto" : "segue a regra de atraso"}.</p><p className="mt-1">{afterTolerance}</p><p className="mt-1">Saída: {exitTolerance > 0 ? `${exitTolerance} minutos de tolerância configurados.` : "tolerância não informada."}</p></section>
    <label className="grid gap-1 text-sm font-medium">Justificativa <span className="font-normal text-[var(--muted-foreground)]">(obrigatória ao alterar a situação ativa)</span><textarea className="input min-h-20" name="reason" placeholder="Explique a alteração quando necessário." /></label><div className="flex flex-wrap justify-end gap-2"><button className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={() => dialog.current?.close()} type="button">Cancelar</button><LoadingButton loadingLabel="Salvando regra…">Salvar regra</LoadingButton></div>
  </form></dialog></>;
}
