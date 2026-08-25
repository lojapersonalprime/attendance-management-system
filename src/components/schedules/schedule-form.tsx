"use client";

import { useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import type { z } from "zod";
import { Clock3, Copy, Sparkles } from "lucide-react";
import { LoadingButton } from "@/components/ui/async-feedback";
import { formatMinutes } from "@/lib/dates/business";
import { scheduleTemplateInputSchema } from "@/modules/employees/domain/validation";
import { calculateScheduleDayDuration } from "@/modules/schedules/domain/duration";

type ScheduleFormValues = z.input<typeof scheduleTemplateInputSchema>;

const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const workweek = [1, 2, 3, 4, 5];

export interface ScheduleFormData {
  id?: string;
  name?: string;
  description?: string | null;
  modelType?: "FIXED" | "FLEXIBLE" | "ATTENDANCE_ONLY";
  active?: boolean;
  days?: Array<{
    weekday: number;
    isWorkingDay: boolean;
    expectedEntry: string | null;
    expectedBreakStart: string | null;
    expectedBreakEnd: string | null;
    expectedExit: string | null;
    expectedMinutes: number;
    expectedBreakMinutes: number;
    minimumBreakMinutes: number | null;
    entryToleranceMinutes: number;
    exitToleranceMinutes: number;
    requiresBreak: boolean;
    excessRequiresApproval: boolean;
  }>;
}

function defaults(schedule?: ScheduleFormData): ScheduleFormValues {
  return {
    name: schedule?.name ?? "",
    description: schedule?.description ?? "",
    modelType: schedule?.modelType ?? "FIXED",
    active: schedule?.active ?? true,
    days: Array.from({ length: 7 }, (_, weekday) => {
      const source = schedule?.days?.find((day) => day.weekday === weekday);
      return {
        weekday,
        isWorkingDay: source?.isWorkingDay ?? false,
        expectedEntry: source?.expectedEntry ?? "",
        expectedBreakStart: source?.expectedBreakStart ?? "",
        expectedBreakEnd: source?.expectedBreakEnd ?? "",
        expectedExit: source?.expectedExit ?? "",
        expectedMinutes: source?.expectedMinutes ?? 0,
        expectedBreakMinutes: source?.expectedBreakMinutes ?? 0,
        minimumBreakMinutes: source?.minimumBreakMinutes ?? undefined,
        entryToleranceMinutes: source?.entryToleranceMinutes ?? 0,
        exitToleranceMinutes: source?.exitToleranceMinutes ?? 0,
        requiresBreak: source?.requiresBreak ?? false,
        excessRequiresApproval: source?.excessRequiresApproval ?? true,
      };
    }),
  };
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
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleTemplateInputSchema) as Resolver<ScheduleFormValues>,
    defaultValues,
    shouldUnregister: true,
  });
  const days = useWatch({ control: form.control, name: "days" }) ?? defaultValues.days;
  const modelType = useWatch({ control: form.control, name: "modelType" }) ?? defaultValues.modelType;
  const [selected, setSelected] = useState<number[]>(() => {
    const persisted = schedule?.days?.filter((day) => day.isWorkingDay).map((day) => day.weekday) ?? [];
    return persisted.length > 0 ? persisted : workweek;
  });
  const [batch, setBatch] = useState({
    entry: "08:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    exit: "17:00",
    entryTolerance: "0",
    exitTolerance: "0",
    minimumBreak: "",
    requiresBreak: true,
    excessRequiresApproval: true,
  });
  const weeklyMinutes = days.reduce((total, day) => total + calculateDurationPreview(day).expectedMinutes, 0);
  const workingDays = days.filter((day) => day.isWorkingDay).length;

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

  const chooseTargets = (targets: number[]) => {
    setSelected(targets);
    applyBatch(targets);
  };

  const toggleTarget = (weekday: number) => {
    if (selected.includes(weekday)) {
      setSelected((current) => current.filter((item) => item !== weekday));
      clearDay(weekday);
      return;
    }
    setSelected((current) => [...current, weekday]);
    applyBatch([weekday]);
  };

  const setDayBreak = (weekday: number, requiresBreak: boolean) => {
    form.setValue(`days.${weekday}.requiresBreak`, requiresBreak);
    if (!requiresBreak) {
      form.setValue(`days.${weekday}.expectedBreakStart`, "");
      form.setValue(`days.${weekday}.expectedBreakEnd`, "");
      form.setValue(`days.${weekday}.minimumBreakMinutes`, undefined);
    }
  };

  const copyMonday = () => {
    const monday = form.getValues("days.1");
    selected.filter((weekday) => weekday !== 1).forEach((weekday) => form.setValue(`days.${weekday}`, { ...monday, weekday }));
  };

  const clearDay = (weekday: number) => form.setValue(`days.${weekday}`, {
    weekday,
    isWorkingDay: false,
    expectedEntry: "",
    expectedBreakStart: "",
    expectedBreakEnd: "",
    expectedExit: "",
    expectedMinutes: 0,
    expectedBreakMinutes: 0,
    minimumBreakMinutes: undefined,
    entryToleranceMinutes: 0,
    exitToleranceMinutes: 0,
    requiresBreak: false,
    excessRequiresApproval: true,
  });

  const setModelType = (next: ScheduleFormValues["modelType"]) => {
    form.setValue("modelType", next);
    if (next !== "FIXED") Array.from({ length: 7 }, (_, weekday) => clearDay(weekday));
  };

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-6"
      onSubmit={(event) => {
        if (allowNativeSubmit.current) {
          allowNativeSubmit.current = false;
          return;
        }
        event.preventDefault();
        void form.trigger().then((valid) => {
          if (valid) {
            allowNativeSubmit.current = true;
            formRef.current?.requestSubmit();
          }
        });
      }}
    >
      {schedule?.id ? <input type="hidden" name="id" value={schedule.id} /> : null}

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">1. Dados básicos</p>
            <h2 className="mt-1 text-lg font-semibold">Nomeie o modelo de horário</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Use um nome que o RH reconheça no momento de atribuir ao funcionário.</p>
          </div>
          <SummaryPill weeklyMinutes={weeklyMinutes} workingDays={workingDays} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nome do modelo" error={form.formState.errors.name?.message}>
            <input className="input" placeholder="Ex.: Administrativo · 08h às 17h" {...form.register("name")} />
          </Field>
          <Field label="Descrição curta" error={form.formState.errors.description?.message}>
            <input className="input" placeholder="Ex.: Equipe administrativa" {...form.register("description")} />
          </Field>
        </div>
        <fieldset className="mt-5"><legend className="text-sm font-semibold">Tipo de modelo</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{([ ["FIXED", "Horário fixo", "Define dias, entrada e saída."], ["FLEXIBLE", "Horário flexível", "Sem carga semanal fixa."], ["ATTENDANCE_ONLY", "Somente presença", "Registra presença, sem jornada prevista."] ] as const).map(([value, title, hint]) => <label className={`cursor-pointer rounded-xl border p-3 text-sm ${modelType === value ? "border-orange-300 bg-orange-50" : "border-slate-200"}`} key={value}><input className="sr-only" name="modelType" type="radio" value={value} checked={modelType === value} onChange={() => setModelType(value)} /> <span className="block font-semibold">{title}</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{hint}</span></label>)}</div></fieldset>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="inactive" defaultChecked={schedule?.active === false} />Salvar como inativo</label>
          {used ? <p className="text-amber-900">Ao salvar, a revisão anterior será preservada internamente e o catálogo continuará com este mesmo modelo.</p> : null}
        </div>
      </section>

      {modelType === "FIXED" ? <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">2. Horário padrão</p>
          <h2 className="mt-1 text-lg font-semibold">Defina uma vez e aplique aos dias escolhidos</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">O resumo semanal é atualizado automaticamente. Campos de intervalo só aparecem quando a pausa é necessária.</p>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold">Dias que receberão este horário</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SelectionButton active={selected.join() === workweek.join()} onClick={() => chooseTargets(workweek)}>Segunda a sexta</SelectionButton>
              <SelectionButton active={selected.join() === [1, 2, 3, 4, 5, 6].join()} onClick={() => chooseTargets([1, 2, 3, 4, 5, 6])}>Segunda a sábado</SelectionButton>
              <SelectionButton active={selected.length === 7} onClick={() => chooseTargets([0, 1, 2, 3, 4, 5, 6])}>Todos os dias</SelectionButton>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {weekdayLabels.map((label, weekday) => <label className="flex items-center gap-2 text-sm" key={label}><input type="checkbox" checked={selected.includes(weekday)} onChange={() => toggleTarget(weekday)} />{label}</label>)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Entrada"><input className="input" type="time" value={batch.entry} onChange={(event) => setBatch({ ...batch, entry: event.target.value })} /></Field>
            <Field label="Saída"><input className="input" type="time" value={batch.exit} onChange={(event) => setBatch({ ...batch, exit: event.target.value })} /></Field>
            <label className="flex items-center gap-2 self-end rounded-lg border px-3 py-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={batch.requiresBreak} onChange={(event) => setBatch({ ...batch, requiresBreak: event.target.checked })} />Esta jornada tem intervalo</label>
            {batch.requiresBreak ? <>
              <Field label="Início do intervalo"><input className="input" type="time" value={batch.breakStart} onChange={(event) => setBatch({ ...batch, breakStart: event.target.value })} /></Field>
              <Field label="Fim do intervalo"><input className="input" type="time" value={batch.breakEnd} onChange={(event) => setBatch({ ...batch, breakEnd: event.target.value })} /></Field>
              <Field label="Intervalo mínimo (min.)"><input className="input" type="number" min="0" value={batch.minimumBreak} onChange={(event) => setBatch({ ...batch, minimumBreak: event.target.value })} /></Field>
            </> : null}
            <Field label="Tolerância de entrada (min.)"><input className="input" type="number" min="0" value={batch.entryTolerance} onChange={(event) => setBatch({ ...batch, entryTolerance: event.target.value })} /></Field>
            <Field label="Tolerância de saída (min.)"><input className="input" type="number" min="0" value={batch.exitTolerance} onChange={(event) => setBatch({ ...batch, exitTolerance: event.target.value })} /></Field>
            <label className="flex items-center gap-2 self-end text-sm sm:col-span-2"><input type="checkbox" checked={batch.excessRequiresApproval} onChange={(event) => setBatch({ ...batch, excessRequiresApproval: event.target.checked })} />Excedentes precisam de aprovação do RH</label>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => applyBatch()}>Aplicar aos dias selecionados</button>
          <button className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" type="button" onClick={() => applyBatch(workweek)}>Aplicar de segunda a sexta</button>
          <button className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold" type="button" onClick={copyMonday}><Copy size={15} aria-hidden="true" />Copiar segunda-feira</button>
        </div>
      </section>
      : <section className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Horário flexível</p><h2 className="mt-1 text-lg font-semibold">Sem dias e carga semanal fixa</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">O modelo não exige entrada, intervalo ou saída previstos. As marcações originais continuam preservadas.</p></section>}

      {modelType === "FIXED" ? <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">3. Dias trabalhados</p>
            <h2 className="mt-1 text-lg font-semibold">Revise somente o que foge do padrão</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Marque folgas e ajuste exceções. A carga é calculada pelo horário registrado, não digitada manualmente.</p>
          </div>
          <div className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-950"><Clock3 className="mr-2 inline" size={16} aria-hidden="true" />{formatMinutes(weeklyMinutes)} por semana</div>
        </div>
        <div className="mt-4 divide-y">
          {days.map((day, index) => {
            const duration = calculateDurationPreview(day);
            return <fieldset className="py-4" key={day.weekday}>
              <input type="hidden" {...form.register(`days.${index}.weekday`, { valueAsNumber: true })} />
              <input type="hidden" name={`days.${index}.excessRequiresApproval`} value={day.excessRequiresApproval ? "on" : ""} />
              <input type="hidden" name={`days.${index}.entryToleranceMinutes`} value={day.entryToleranceMinutes ?? 0} />
              <input type="hidden" name={`days.${index}.exitToleranceMinutes`} value={day.exitToleranceMinutes ?? 0} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-3 font-semibold"><input type="checkbox" {...form.register(`days.${index}.isWorkingDay`)} />{weekdayLabels[day.weekday]}</label>
                <div className="flex items-center gap-3 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1">{day.isWorkingDay ? `${formatMinutes(duration.expectedMinutes)} · ${day.requiresBreak ? "com intervalo" : "sem intervalo"}` : "Folga"}</span>{day.isWorkingDay ? <button className="text-sm font-medium text-[var(--primary)]" type="button" onClick={() => applyBatch([day.weekday])}>Usar padrão</button> : null}<button className="text-sm text-[var(--muted-foreground)] underline" type="button" onClick={() => clearDay(day.weekday)}>Marcar folga</button></div>
              </div>
              {day.isWorkingDay ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Field label="Entrada" error={form.formState.errors.days?.[index]?.expectedEntry?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedEntry`)} /></Field>
                <Field label="Saída" error={form.formState.errors.days?.[index]?.expectedExit?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedExit`)} /></Field>
                <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm font-medium"><input type="checkbox" name={`days.${index}.requiresBreak`} checked={Boolean(day.requiresBreak)} onChange={(event) => setDayBreak(index, event.target.checked)} />Tem intervalo</label>
                {day.requiresBreak ? <>
                  <Field label="Início do intervalo" error={form.formState.errors.days?.[index]?.expectedBreakStart?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedBreakStart`)} /></Field>
                  <Field label="Fim do intervalo" error={form.formState.errors.days?.[index]?.expectedBreakEnd?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedBreakEnd`)} /></Field>
                </> : null}
              </div> : null}
            </fieldset>;
          })}
        </div>
        {form.formState.errors.days?.message ? <p className="mt-3 text-sm text-red-700">{form.formState.errors.days.message}</p> : null}
      </section>
      : null}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="text-sm"><p className="font-semibold">Resumo pronto para salvar</p><p className="text-[var(--muted-foreground)]">{workingDays} dia(s) de trabalho · {formatMinutes(weeklyMinutes)} por semana</p></div>
        <LoadingButton className="px-5 py-2.5" loadingLabel="Salvando modelo…"><Sparkles size={16} aria-hidden="true" />{schedule ? "Salvar modelo" : "Criar modelo"}</LoadingButton>
      </div>
    </form>
  );
}

function SelectionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`rounded-md border px-3 py-2 text-sm font-medium ${active ? "border-orange-300 bg-orange-50 text-[var(--primary)]" : "bg-white"}`} type="button" onClick={onClick}>{children}</button>;
}

function SummaryPill({ weeklyMinutes, workingDays }: { weeklyMinutes: number; workingDays: number }) {
  return <div className="rounded-lg bg-slate-950 px-4 py-3 text-right text-sm text-white"><p className="text-slate-300">Resumo automático</p><p className="mt-1 font-semibold">{workingDays} dia(s) · {formatMinutes(weeklyMinutes)}</p></div>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}{error ? <span className="text-xs font-normal text-red-700">{error}</span> : null}</label>;
}
