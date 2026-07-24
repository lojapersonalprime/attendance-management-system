"use client";

import { useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import type { z } from "zod";
import { LoadingButton } from "@/components/ui/async-feedback";
import { completeProvisionalEmployeeSchema, employeeInputSchema, employmentTypeLabels, employmentTypes, employeeStatusLabels, employeeStatuses } from "@/modules/employees/domain/validation";

type EmployeeFormValues = z.input<typeof employeeInputSchema>;

interface Option {
  id: string;
  name: string;
}

export interface EmployeeFormData {
  fullName?: string;
  clockNameRaw?: string | null;
  registration?: string | null;
  cpf?: string | null;
  employmentType?: (typeof employmentTypes)[number];
  status?: Exclude<(typeof employeeStatuses)[number], "MERGED">;
  positionId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
  admissionDate?: string | null;
  terminationDate?: string | null;
  notes?: string | null;
  tagIds?: string[];
}

export function EmployeeForm({ action, employee, employeeId, units, departments, positions, tags, completion = false }: {
  action: (formData: FormData) => void | Promise<void>;
  employee?: EmployeeFormData;
  employeeId?: string;
  units: Option[];
  departments: Option[];
  positions: Option[];
  tags: Option[];
  completion?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowNativeSubmit = useRef(false);
  const requiresCoreFields = completion || !employee;
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(requiresCoreFields ? completeProvisionalEmployeeSchema : employeeInputSchema) as Resolver<EmployeeFormValues>,
    defaultValues: {
      fullName: employee?.fullName ?? "",
      clockNameRaw: employee?.clockNameRaw ?? "",
      registration: employee?.registration ?? "",
      cpf: employee?.cpf ?? "",
      employmentType: employee?.employmentType ?? "EMPLOYEE",
      status: employee?.status ?? "ACTIVE",
      positionId: employee?.positionId ?? "",
      departmentId: employee?.departmentId ?? "",
      unitId: employee?.unitId ?? "",
      admissionDate: employee?.admissionDate ?? "",
      terminationDate: employee?.terminationDate ?? "",
      notes: employee?.notes ?? "",
      tagIds: employee?.tagIds ?? [],
    },
  });

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-4"
      onSubmit={(event) => {
        if (allowNativeSubmit.current) {
          allowNativeSubmit.current = false;
          return;
        }
        event.preventDefault();
        void form.trigger().then((valid) => {
          if (!valid) return;
          allowNativeSubmit.current = true;
          formRef.current?.requestSubmit();
        });
      }}
    >
      {employeeId ? <input type="hidden" name="employeeId" value={employeeId} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome completo" error={form.formState.errors.fullName?.message}><input className="input" autoComplete="name" {...form.register("fullName")} /></Field>
        <Field label="Nome original no relógio" hint="Preservado como referência; não é chave de identificação." error={form.formState.errors.clockNameRaw?.message}><input className="input" {...form.register("clockNameRaw")} /></Field>
        <Field label="Matrícula" error={form.formState.errors.registration?.message}><input className="input" {...form.register("registration")} /></Field>
        <Field label="CPF" hint="Opcional e mascarado nas listagens." error={form.formState.errors.cpf?.message}><input className="input" inputMode="numeric" {...form.register("cpf")} /></Field>
        <Field label="Tipo de vínculo" error={form.formState.errors.employmentType?.message}><select className="input" {...form.register("employmentType")}>{employmentTypes.map((type) => <option key={type} value={type}>{employmentTypeLabels[type]}</option>)}</select></Field>
        <Field label="Status" error={form.formState.errors.status?.message}><select className="input" {...form.register("status")}>{employeeStatuses.filter((status) => status !== "MERGED").map((status) => <option key={status} value={status}>{employeeStatusLabels[status]}</option>)}</select></Field>
        <Field label="Unidade" required={requiresCoreFields} error={form.formState.errors.unitId?.message}><select className="input" {...form.register("unitId")}><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></Field>
        <Field label="Setor" error={form.formState.errors.departmentId?.message}><select className="input" {...form.register("departmentId")}><option value="">Sem setor</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
        <Field label="Cargo" error={form.formState.errors.positionId?.message}><select className="input" {...form.register("positionId")}><option value="">Sem cargo</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</select></Field>
        <Field label="Data de admissão" required={requiresCoreFields} error={form.formState.errors.admissionDate?.message}><input className="input" type="date" {...form.register("admissionDate")} /></Field>
        <Field label="Data de desligamento" error={form.formState.errors.terminationDate?.message}><input className="input" type="date" {...form.register("terminationDate")} /></Field>
      </div>
      <Field label="Observação" error={form.formState.errors.notes?.message}><textarea className="input min-h-24" {...form.register("notes")} /></Field>
      <fieldset className="rounded-lg border p-4"><legend className="px-1 text-sm font-semibold">Tags para organização e filtro</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tags.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">Nenhuma tag ativa cadastrada.</p> : tags.map((tag) => <label className="flex items-center gap-2 text-sm" key={tag.id}><input type="checkbox" value={tag.id} {...form.register("tagIds")} />{tag.name}</label>)}</div></fieldset>
      <p className="text-xs text-[var(--muted-foreground)]">A jornada pode ser atribuída em seguida. Sem jornada válida, a apuração ficará aguardando configuração e nenhum horário será inventado.</p>
      <LoadingButton loadingLabel="Salvando dados…">{completion ? "Concluir cadastro" : employee ? "Salvar alterações" : "Criar funcionário"}</LoadingButton>
    </form>
  );
}

function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{required ? " *" : ""}{children}{hint ? <span className="text-xs font-normal text-[var(--muted-foreground)]">{hint}</span> : null}{error ? <span className="text-xs font-normal text-red-700">{error}</span> : null}</label>;
}
