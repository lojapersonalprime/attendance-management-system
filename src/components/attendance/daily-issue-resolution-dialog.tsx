"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/async-feedback";

type ResolutionAction =
  | "ADD_MISSING_PUNCH"
  | "CORRECT_PUNCH_INTERPRETATION"
  | "JUSTIFY_ABSENCE"
  | "MEDICAL_CERTIFICATE"
  | "EXTERNAL_WORK"
  | "APPROVE_EXCESS"
  | "APPLY_POLICY_TOLERANCE"
  | "DISMISS_WARNING"
  | "MARK_IN_REVIEW"
  | "RESOLVE_ALREADY_CORRECTED";

const labels: Record<ResolutionAction, string> = {
  ADD_MISSING_PUNCH: "Adicionar batida esquecida",
  CORRECT_PUNCH_INTERPRETATION: "Corrigir interpretação da batida",
  JUSTIFY_ABSENCE: "Justificar ausência",
  MEDICAL_CERTIFICATE: "Registrar atestado",
  EXTERNAL_WORK: "Registrar trabalho externo",
  APPROVE_EXCESS: "Aprovar tempo excedente",
  APPLY_POLICY_TOLERANCE: "Aplicar tolerância prevista na política",
  DISMISS_WARNING: "Dispensar aviso",
  MARK_IN_REVIEW: "Marcar para revisão",
  RESOLVE_ALREADY_CORRECTED: "Resolver pendência já corrigida",
};

function availableActions(types: string[]): ResolutionAction[] {
  const actions = new Set<ResolutionAction>(["MARK_IN_REVIEW", "DISMISS_WARNING", "RESOLVE_ALREADY_CORRECTED"]);
  if (types.some((type) => ["MISSING_ENTRY", "MISSING_EXIT", "MISSING_BREAK_OUT", "MISSING_BREAK_RETURN", "ODD_PUNCH_COUNT", "INCOMPLETE_DAY"].includes(type))) actions.add("ADD_MISSING_PUNCH");
  if (types.some((type) => ["INVALID_SEQUENCE", "POSSIBLE_DUPLICATE", "MULTIPLE_ENTRIES", "MULTIPLE_EXITS"].includes(type))) actions.add("CORRECT_PUNCH_INTERPRETATION");
  if (types.includes("NO_PUNCHES_ON_SCHEDULED_DAY")) {
    actions.add("JUSTIFY_ABSENCE");
    actions.add("MEDICAL_CERTIFICATE");
    actions.add("EXTERNAL_WORK");
  }
  if (types.includes("EXCESS_TIME_PENDING")) actions.add("APPROVE_EXCESS");
  if (types.includes("LATE_ARRIVAL")) actions.add("APPLY_POLICY_TOLERANCE");
  return [...actions];
}

export function DailyIssueResolutionDialog({
  action,
  summaryId,
  employeeId,
  inconsistencyId,
  issueTypes,
  rawPunches,
}: {
  action: (formData: FormData) => void | Promise<void>;
  summaryId: string;
  employeeId: string;
  inconsistencyId: string;
  issueTypes: string[];
  rawPunches: Array<{ id: string; label: string }>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const options = useMemo(() => availableActions(issueTypes), [issueTypes]);
  const [choice, setChoice] = useState<ResolutionAction>(options[0] ?? "MARK_IN_REVIEW");
  const needsPunchTime = choice === "ADD_MISSING_PUNCH";
  const needsOriginalPunch = choice === "CORRECT_PUNCH_INTERPRETATION";
  const needsMinutes = choice === "APPROVE_EXCESS";

  return <><button className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white" type="button" onClick={() => dialog.current?.showModal()}>Resolver pendência</button><dialog className="m-auto w-[min(94vw,640px)] rounded-xl border p-0 shadow-2xl backdrop:bg-slate-950/40" ref={dialog}><form action={action} className="grid gap-4 p-5"><input type="hidden" name="summaryId" value={summaryId} /><input type="hidden" name="employeeId" value={employeeId} /><input type="hidden" name="inconsistencyId" value={inconsistencyId} /><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Tratamento da pendência</p><h2 className="mt-1 text-lg font-semibold">O que precisa ser feito?</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">O tratamento preserva o arquivo original e recalcula somente este dia quando necessário.</p></div><label className="grid gap-1 text-sm font-medium">Ação<select className="input" name="action" value={choice} onChange={(event) => setChoice(event.target.value as ResolutionAction)}>{options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></label>{needsPunchTime ? <><label className="grid gap-1 text-sm font-medium">Tipo da batida<select className="input" name="adjustedPunchCode" defaultValue="F"><option value="S">Entrada</option><option value="E">Saída para intervalo</option><option value="A">Retorno do intervalo</option><option value="F">Saída final</option></select></label><label className="grid gap-1 text-sm font-medium">Horário<input className="input" name="adjustedTime" type="time" required /></label></> : null}{needsOriginalPunch ? <label className="grid gap-1 text-sm font-medium">Marcação original a desconsiderar<select className="input" name="originalPunchId" required><option value="">Selecione</option>{rawPunches.map((punch) => <option key={punch.id} value={punch.id}>{punch.label}</option>)}</select></label> : null}{needsMinutes ? <label className="grid gap-1 text-sm font-medium">Quantidade aprovada (minutos)<input className="input" name="minutesApproved" min="1" max="1440" type="number" required /></label> : null}<label className="grid gap-1 text-sm font-medium">Justificativa<textarea className="input min-h-24" name="reason" required minLength={3} placeholder="Explique o tratamento realizado." /></label><PendingTreatment /><div className="flex flex-wrap justify-end gap-2"><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="button" onClick={() => dialog.current?.close()}>Cancelar</button><LoadingButton loadingLabel="Salvando tratamento…">Salvar tratamento</LoadingButton></div></form></dialog></>;
}

function PendingTreatment() {
  const { pending } = useFormStatus();
  return pending ? <p aria-live="polite" className="rounded-lg bg-orange-50 p-3 text-sm text-orange-950" role="status">Salvando tratamento, recalculando o dia e atualizando o saldo…</p> : null;
}
