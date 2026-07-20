"use client";

import { useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import type { z } from "zod";
import { scheduleTemplateInputSchema } from "@/modules/employees/domain/validation";

type ScheduleFormValues = z.input<typeof scheduleTemplateInputSchema>;

const weekdayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export interface ScheduleFormData {
  id?: string;
  name?: string;
  description?: string | null;
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

function numericInputValue(value: unknown) {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ScheduleForm({ action, schedule, used = false }: { action: (formData: FormData) => void | Promise<void>; schedule?: ScheduleFormData; used?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowNativeSubmit = useRef(false);
  const defaultValues = useMemo(() => defaults(schedule), [schedule]);
  const form = useForm<ScheduleFormValues>({ resolver: zodResolver(scheduleTemplateInputSchema) as Resolver<ScheduleFormValues>, defaultValues, shouldUnregister: true });
  const days = useWatch({ control: form.control, name: "days" }) ?? defaultValues.days;
  return <form ref={formRef} action={action} className="space-y-5" onSubmit={(event) => {
    if (allowNativeSubmit.current) { allowNativeSubmit.current = false; return; }
    event.preventDefault();
    void form.trigger().then((valid) => { if (valid) { allowNativeSubmit.current = true; formRef.current?.requestSubmit(); } });
  }}>
    {schedule?.id ? <input type="hidden" name="id" value={schedule.id} /> : null}
    <div className="grid gap-4 md:grid-cols-2"><Field label="Nome" error={form.formState.errors.name?.message}><input className="input" {...form.register("name")} /></Field><Field label="Descrição" error={form.formState.errors.description?.message}><input className="input" {...form.register("description")} /></Field></div>
    {used ? <label className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" name="createVersion" />Criar nova versão em vez de alterar a jornada histórica</label> : null}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inactive" defaultChecked={schedule?.active === false} />Criar/editar como inativa</label>
    <p className="rounded-md border bg-slate-50 p-3 text-sm text-[var(--muted-foreground)]">O RH define horários e tolerâncias conforme contrato e política interna. O sistema não presume regras legais. Para dias trabalhados, os minutos precisam corresponder aos horários informados.</p>
    <div className="space-y-3">{days.map((day, index) => <fieldset className="rounded-lg border p-4" key={day.weekday}><legend className="px-1 text-sm font-semibold">{weekdayLabels[day.weekday]}</legend><input type="hidden" {...form.register(`days.${index}.weekday`, { setValueAs: numericInputValue })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register(`days.${index}.isWorkingDay`)} />Dia trabalhado</label>{day.isWorkingDay ? <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-5"><Field label="Entrada" error={form.formState.errors.days?.[index]?.expectedEntry?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedEntry`)} /></Field><Field label="Saída intervalo" error={form.formState.errors.days?.[index]?.expectedBreakStart?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedBreakStart`)} /></Field><Field label="Retorno" error={form.formState.errors.days?.[index]?.expectedBreakEnd?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedBreakEnd`)} /></Field><Field label="Saída final" error={form.formState.errors.days?.[index]?.expectedExit?.message}><input className="input" type="time" {...form.register(`days.${index}.expectedExit`)} /></Field><Field label="Minutos previstos" error={form.formState.errors.days?.[index]?.expectedMinutes?.message}><input className="input" type="number" min="0" {...form.register(`days.${index}.expectedMinutes`, { setValueAs: numericInputValue })} /></Field><Field label="Minutos intervalo" error={form.formState.errors.days?.[index]?.expectedBreakMinutes?.message}><input className="input" type="number" min="0" {...form.register(`days.${index}.expectedBreakMinutes`, { setValueAs: numericInputValue })} /></Field><Field label="Mínimo intervalo" error={form.formState.errors.days?.[index]?.minimumBreakMinutes?.message}><input className="input" type="number" min="0" {...form.register(`days.${index}.minimumBreakMinutes`, { setValueAs: numericInputValue })} /></Field><Field label="Tolerância entrada" error={form.formState.errors.days?.[index]?.entryToleranceMinutes?.message}><input className="input" type="number" min="0" {...form.register(`days.${index}.entryToleranceMinutes`, { setValueAs: numericInputValue })} /></Field><Field label="Tolerância saída" error={form.formState.errors.days?.[index]?.exitToleranceMinutes?.message}><input className="input" type="number" min="0" {...form.register(`days.${index}.exitToleranceMinutes`, { setValueAs: numericInputValue })} /></Field><div className="grid content-end gap-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" {...form.register(`days.${index}.requiresBreak`)} />Exige intervalo</label><label className="flex items-center gap-2"><input type="checkbox" {...form.register(`days.${index}.excessRequiresApproval`)} />Excedente exige aprovação</label></div></div> : <p className="mt-2 text-sm text-[var(--muted-foreground)]">Folga sem horários obrigatórios.</p>}</fieldset>)}</div>
    <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">{schedule ? "Salvar jornada" : "Criar jornada"}</button>
  </form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}{error ? <span className="text-xs font-normal text-red-700">{error}</span> : null}</label>;
}
