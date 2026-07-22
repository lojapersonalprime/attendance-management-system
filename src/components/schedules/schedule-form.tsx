"use client";

import { useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import type { z } from "zod";
import { formatMinutes } from "@/lib/dates/business";
import { scheduleTemplateInputSchema } from "@/modules/employees/domain/validation";
import { calculateScheduleDayDuration } from "@/modules/schedules/domain/duration";

type ScheduleFormValues = z.input<typeof scheduleTemplateInputSchema>;
const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const workweek = [1, 2, 3, 4, 5];

export interface ScheduleFormData { id?: string; name?: string; description?: string | null; active?: boolean; days?: Array<{ weekday: number; isWorkingDay: boolean; expectedEntry: string | null; expectedBreakStart: string | null; expectedBreakEnd: string | null; expectedExit: string | null; expectedMinutes: number; expectedBreakMinutes: number; minimumBreakMinutes: number | null; entryToleranceMinutes: number; exitToleranceMinutes: number; requiresBreak: boolean; excessRequiresApproval: boolean; }>; }

function defaults(schedule?: ScheduleFormData): ScheduleFormValues {
  return { name: schedule?.name ?? "", description: schedule?.description ?? "", active: schedule?.active ?? true, days: Array.from({ length: 7 }, (_, weekday) => { const source = schedule?.days?.find((day) => day.weekday === weekday); return { weekday, isWorkingDay: source?.isWorkingDay ?? false, expectedEntry: source?.expectedEntry ?? "", expectedBreakStart: source?.expectedBreakStart ?? "", expectedBreakEnd: source?.expectedBreakEnd ?? "", expectedExit: source?.expectedExit ?? "", expectedMinutes: source?.expectedMinutes ?? 0, expectedBreakMinutes: source?.expectedBreakMinutes ?? 0, minimumBreakMinutes: source?.minimumBreakMinutes ?? undefined, entryToleranceMinutes: source?.entryToleranceMinutes ?? 0, exitToleranceMinutes: source?.exitToleranceMinutes ?? 0, requiresBreak: source?.requiresBreak ?? false, excessRequiresApproval: source?.excessRequiresApproval ?? true }; }) };
}

function calculateDurationPreview(day: ScheduleFormValues["days"][number]) {
  return calculateScheduleDayDuration({
    expectedEntry: day.expectedEntry,
    expectedBreakStart: day.expectedBreakStart,
    expectedBreakEnd: day.expectedBreakEnd,
    expectedExit: day.expectedExit,
    requiresBreak: day.requiresBreak ?? false,
    isWorkingDay: day.isWorkingDay,
  });
}

export function ScheduleForm({ action, schedule, used = false }: { action: (formData: FormData) => void | Promise<void>; schedule?: ScheduleFormData; used?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowNativeSubmit = useRef(false);
  const defaultValues = useMemo(() => defaults(schedule), [schedule]);
  const form = useForm<ScheduleFormValues>({ resolver: zodResolver(scheduleTemplateInputSchema) as Resolver<ScheduleFormValues>, defaultValues, shouldUnregister: true });
  const days = useWatch({ control: form.control, name: "days" }) ?? defaultValues.days;
  const [selected, setSelected] = useState<number[]>(workweek);
  const [batch, setBatch] = useState({ entry: "08:00", breakStart: "12:00", breakEnd: "13:00", exit: "17:00", entryTolerance: "0", exitTolerance: "0", minimumBreak: "", requiresBreak: true, excessRequiresApproval: true });
  const setPreset = (preset: number[]) => setSelected(preset);
  const applyBatch = (targets = selected) => targets.forEach((weekday) => {
    form.setValue(`days.${weekday}.isWorkingDay`, true);
    form.setValue(`days.${weekday}.expectedEntry`, batch.entry);
    form.setValue(`days.${weekday}.expectedBreakStart`, batch.requiresBreak ? batch.breakStart : "");
    form.setValue(`days.${weekday}.expectedBreakEnd`, batch.requiresBreak ? batch.breakEnd : "");
    form.setValue(`days.${weekday}.expectedExit`, batch.exit);
    form.setValue(`days.${weekday}.entryToleranceMinutes`, Number(batch.entryTolerance) || 0);
    form.setValue(`days.${weekday}.exitToleranceMinutes`, Number(batch.exitTolerance) || 0);
    form.setValue(`days.${weekday}.minimumBreakMinutes`, batch.requiresBreak && batch.minimumBreak !== "" ? Number(batch.minimumBreak) : undefined);
    form.setValue(`days.${weekday}.requiresBreak`, batch.requiresBreak);
    form.setValue(`days.${weekday}.excessRequiresApproval`, batch.excessRequiresApproval);
  });
  const copyMonday = (targets = selected) => {
    const monday = form.getValues("days.1");
    targets.filter((weekday) => weekday !== 1).forEach((weekday) => form.setValue(`days.${weekday}`, { ...monday, weekday }));
  };
  const clearDay = (weekday: number) => {
    form.setValue(`days.${weekday}`, { weekday, isWorkingDay: false, expectedEntry: "", expectedBreakStart: "", expectedBreakEnd: "", expectedExit: "", expectedMinutes: 0, expectedBreakMinutes: 0, minimumBreakMinutes: undefined, entryToleranceMinutes: 0, exitToleranceMinutes: 0, requiresBreak: false, excessRequiresApproval: true });
  };
  const weeklyMinutes = days.reduce((total, day) => total + calculateDurationPreview(day).expectedMinutes, 0);
  const workingDays = days.filter((day) => day.isWorkingDay).length;
  return <form ref={formRef} action={action} className="space-y-5" onSubmit={(event) => { if (allowNativeSubmit.current) { allowNativeSubmit.current = false; return; } event.preventDefault(); void form.trigger().then((valid) => { if (valid) { allowNativeSubmit.current = true; formRef.current?.requestSubmit(); } }); }}>
    {schedule?.id ? <input type="hidden" name="id" value={schedule.id} /> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Nome" error={form.formState.errors.name?.message}><input className="input" {...form.register("name")} /></Field><Field label="Descrição" error={form.formState.errors.description?.message}><input className="input" {...form.register("description")} /></Field></div>
    {used ? <label className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" name="createVersion" />Criar nova versão para preservar o histórico</label> : null}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inactive" defaultChecked={schedule?.active === false} />Criar/editar como inativa</label>
    <section className="rounded-lg border bg-slate-50 p-4"><h2 className="font-semibold">Quais dias possuem o mesmo horário?</h2><div className="mt-3 flex flex-wrap gap-2"><button className="rounded border px-3 py-2 text-sm" type="button" onClick={() => setPreset(workweek)}>Segunda a sexta</button><button className="rounded border px-3 py-2 text-sm" type="button" onClick={() => setPreset([1, 2, 3, 4, 5, 6])}>Segunda a sábado</button><button className="rounded border px-3 py-2 text-sm" type="button" onClick={() => setPreset([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</button><button className="rounded border px-3 py-2 text-sm" type="button" onClick={() => setSelected([])}>Personalizado</button></div><div className="mt-3 flex flex-wrap gap-3">{weekdayLabels.map((label, weekday) => <label className="flex items-center gap-1 text-sm" key={label}><input type="checkbox" checked={selected.includes(weekday)} onChange={() => setSelected((current) => current.includes(weekday) ? current.filter((item) => item !== weekday) : [...current, weekday])} />{label}</label>)}</div></section>
    <section className="rounded-lg border p-4"><h2 className="font-semibold">Horário padrão</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">A carga e o intervalo são calculados automaticamente. As regras devem ser validadas pelo RH conforme contrato e política interna.</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Entrada"><input className="input" type="time" value={batch.entry} onChange={(event) => setBatch({ ...batch, entry: event.target.value })} /></Field><Field label="Saída para intervalo"><input className="input" type="time" disabled={!batch.requiresBreak} value={batch.breakStart} onChange={(event) => setBatch({ ...batch, breakStart: event.target.value })} /></Field><Field label="Retorno do intervalo"><input className="input" type="time" disabled={!batch.requiresBreak} value={batch.breakEnd} onChange={(event) => setBatch({ ...batch, breakEnd: event.target.value })} /></Field><Field label="Saída final"><input className="input" type="time" value={batch.exit} onChange={(event) => setBatch({ ...batch, exit: event.target.value })} /></Field><Field label="Tolerância de entrada"><input className="input" type="number" min="0" value={batch.entryTolerance} onChange={(event) => setBatch({ ...batch, entryTolerance: event.target.value })} /></Field><Field label="Tolerância de saída"><input className="input" type="number" min="0" value={batch.exitTolerance} onChange={(event) => setBatch({ ...batch, exitTolerance: event.target.value })} /></Field><Field label="Intervalo mínimo"><input className="input" type="number" min="0" disabled={!batch.requiresBreak} value={batch.minimumBreak} onChange={(event) => setBatch({ ...batch, minimumBreak: event.target.value })} /></Field><div className="grid content-end gap-2 text-sm"><label><input type="checkbox" checked={batch.requiresBreak} onChange={(event) => setBatch({ ...batch, requiresBreak: event.target.checked })} /> Exige intervalo</label><label><input type="checkbox" checked={batch.excessRequiresApproval} onChange={(event) => setBatch({ ...batch, excessRequiresApproval: event.target.checked })} /> Excedente exige aprovação</label></div></div><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => applyBatch()}>Aplicar horário aos dias selecionados</button><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="button" onClick={() => applyBatch(workweek)}>Aplicar de segunda a sexta</button><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="button" onClick={() => applyBatch(days.filter((day) => day.isWorkingDay).map((day) => day.weekday))}>Aplicar a todos os dias trabalhados</button><button className="rounded-md border px-3 py-2 text-sm font-semibold" type="button" onClick={() => copyMonday()}>Copiar horário de segunda-feira</button></div></section>
    <section className="rounded-lg border p-4"><h2 className="font-semibold">Jornada semanal</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Carga semanal: <strong>{formatMinutes(weeklyMinutes)}</strong> · Dias trabalhados: <strong>{workingDays}</strong></p><div className="mt-3 divide-y">{days.map((day, index) => { const duration = calculateDurationPreview(day); return <fieldset className="py-3" key={day.weekday}><input type="hidden" {...form.register(`days.${index}.weekday`, { valueAsNumber: true })} /><input type="hidden" name={`days.${index}.requiresBreak`} value={day.requiresBreak ? "on" : ""} /><input type="hidden" name={`days.${index}.excessRequiresApproval`} value={day.excessRequiresApproval ? "on" : ""} /><input type="hidden" name={`days.${index}.entryToleranceMinutes`} value={day.entryToleranceMinutes ?? 0} /><input type="hidden" name={`days.${index}.exitToleranceMinutes`} value={day.exitToleranceMinutes ?? 0} /><input type="hidden" name={`days.${index}.minimumBreakMinutes`} value={day.minimumBreakMinutes ?? ""} /><div className="flex flex-wrap items-center justify-between gap-2"><legend className="font-medium">{weekdayLabels[day.weekday]}</legend><span className="text-sm">{day.isWorkingDay ? `${day.expectedEntry}${day.requiresBreak ? `–${day.expectedBreakStart ?? ""} | ${day.expectedBreakEnd ?? ""}–` : "–"}${day.expectedExit} | ${formatMinutes(duration.expectedMinutes)}` : "Folga"}</span><div className="flex gap-2"><button className="text-sm underline" type="button" onClick={() => applyBatch([day.weekday])}>Aplicar padrão</button><button className="text-sm underline" type="button" onClick={() => clearDay(day.weekday)}>Limpar dia</button><button className="text-sm underline" type="button" onClick={() => clearDay(day.weekday)}>Marcar como folga</button></div></div><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" {...form.register(`days.${index}.isWorkingDay`)} />Dia trabalhado</label>{day.isWorkingDay ? <div className="mt-2 grid gap-2 md:grid-cols-4"><Field label="Entrada" error={form.formState.errors.days?.[index]?.expectedEntry?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedEntry`)} /></Field><Field label="Saída intervalo" error={form.formState.errors.days?.[index]?.expectedBreakStart?.message}><input className="input" type="time" disabled={!day.requiresBreak} {...form.register(`days.${index}.expectedBreakStart`)} /></Field><Field label="Retorno" error={form.formState.errors.days?.[index]?.expectedBreakEnd?.message}><input className="input" type="time" disabled={!day.requiresBreak} {...form.register(`days.${index}.expectedBreakEnd`)} /></Field><Field label="Saída" error={form.formState.errors.days?.[index]?.expectedExit?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedExit`)} /></Field></div> : null}</fieldset>; })}</div>{form.formState.errors.days?.message ? <p className="mt-2 text-sm text-red-700">{form.formState.errors.days.message}</p> : null}</section>
    <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">{schedule ? "Salvar jornada" : "Criar jornada"}</button>
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm font-medium">{label}{children}{error ? <span className="text-xs font-normal text-red-700">{error}</span> : null}</label>; }
