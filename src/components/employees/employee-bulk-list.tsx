"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { employeeRoute } from "@/lib/routes";
import { employeeStatusLabels, employmentTypeLabels, employmentTypes } from "@/modules/employees/domain/validation";

interface Option { id: string; name: string }

interface EmployeeRow {
  id: string;
  fullName: string;
  registration: string | null;
  employmentType: keyof typeof employmentTypeLabels;
  status: keyof typeof employeeStatusLabels;
  provisional: boolean;
  unit: { name: string } | null;
  department: { name: string } | null;
  position: { name: string } | null;
  tagAssignments: Array<{ employeeTag: { name: string } }>;
  deviceLinks: Array<{ externalEmployeeNumber: string; active: boolean; rawPunches: Array<{ occurredAt: Date }> }>;
  scheduleAssignments: Array<{ scheduleTemplate: { name: string } }>;
}

type BulkAction = "EMPLOYMENT_TYPE" | "UNIT" | "DEPARTMENT" | "POSITION" | "ADD_TAG" | "REMOVE_TAG" | "SCHEDULE" | "STATUS" | "RECALCULATE";

const actionLabels: Record<BulkAction, string> = {
  EMPLOYMENT_TYPE: "Definir tipo de vínculo",
  UNIT: "Definir unidade",
  DEPARTMENT: "Definir setor",
  POSITION: "Definir cargo",
  ADD_TAG: "Adicionar tag",
  REMOVE_TAG: "Remover tag",
  SCHEDULE: "Atribuir jornada",
  STATUS: "Alterar status",
  RECALCULATE: "Solicitar recálculo",
};

export function EmployeeBulkList({ action, employees, units, departments, positions, tags, schedules }: {
  action: (formData: FormData) => void | Promise<void>;
  employees: EmployeeRow[];
  units: Option[];
  departments: Option[];
  positions: Option[];
  tags: Option[];
  schedules: Option[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | "">("");
  const selectedCount = selected.size;
  const allSelected = employees.length > 0 && employees.every((employee) => selected.has(employee.id));
  const currentOptions = useMemo(() => {
    if (bulkAction === "UNIT") return units;
    if (bulkAction === "DEPARTMENT") return departments;
    if (bulkAction === "POSITION") return positions;
    if (bulkAction === "ADD_TAG" || bulkAction === "REMOVE_TAG") return tags;
    return [];
  }, [bulkAction, departments, positions, tags, units]);
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(employees.map((employee) => employee.id)));

  return (
    <form action={action} className="space-y-4">
      {selectedCount > 0 ? <section className="grid gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"><div className="lg:col-span-4"><p className="font-semibold">{selectedCount} funcionário(s) selecionado(s)</p><p className="text-sm text-[var(--muted-foreground)]">Escolha uma ação para continuar. O motivo será solicitado apenas quando necessário.</p></div>
        <label className="grid gap-1 text-sm font-medium">Escolher ação<select className="input" name="bulkAction" value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction | "")}><option value="">Selecione</option>{(Object.keys(actionLabels) as BulkAction[]).map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}</select></label>
        {bulkAction === "EMPLOYMENT_TYPE" ? <label className="grid gap-1 text-sm font-medium">Tipo de vínculo<select className="input" name="bulkValue">{employmentTypes.map((type) => <option key={type} value={type}>{employmentTypeLabels[type]}</option>)}</select></label> : null}
        {bulkAction === "STATUS" ? <label className="grid gap-1 text-sm font-medium">Status<select className="input" name="bulkValue">{(["ACTIVE", "ON_LEAVE", "VACATION", "INACTIVE", "TERMINATED"] as const).map((status) => <option key={status} value={status}>{employeeStatusLabels[status]}</option>)}</select></label> : null}
        {bulkAction === "STATUS" ? <label className="grid gap-1 text-sm font-medium">Data de desligamento<input className="input" type="date" name="terminationDate" /></label> : null}
        {currentOptions.length > 0 ? <label className="grid gap-1 text-sm font-medium">Valor<select className="input" name="bulkValue"><option value="">Selecione</option>{currentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        {bulkAction === "SCHEDULE" ? <label className="grid gap-1 text-sm font-medium">Jornada<select className="input" name="scheduleTemplateId"><option value="">Selecione</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}</select></label> : null}
        {(bulkAction === "SCHEDULE" || bulkAction === "RECALCULATE") ? <><label className="grid gap-1 text-sm font-medium">Data inicial<input className="input" type="date" name="validFrom" /></label><label className="grid gap-1 text-sm font-medium">Data final<input className="input" type="date" name="validUntil" /></label></> : null}
        {bulkAction === "SCHEDULE" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="closePrevious" />Encerrar jornada anterior</label> : null}
        {bulkAction === "SCHEDULE" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="retroactiveConfirmed" />Confirmar vigência retroativa</label> : null}
        <label className="grid gap-1 text-sm font-medium lg:col-span-2">Motivo{["SCHEDULE", "STATUS", "RECALCULATE", "REMOVE_TAG"].includes(bulkAction) ? " *" : ""}<input className="input" name="reason" placeholder="Obrigatório em ações críticas" /></label>
        <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!bulkAction}>Aplicar em {selectedCount} selecionado(s)</button>
      </section> : null}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-3 py-3"><input aria-label="Selecionar todos desta página" type="checkbox" checked={allSelected} onChange={toggleAll} /></th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Vínculo</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Última marcação</th><th className="px-4 py-3">Ações</th></tr></thead><tbody>{employees.map((employee) => {
          const lastPunch = employee.deviceLinks.flatMap((link) => link.rawPunches).sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
          return <tr className="border-b last:border-0" key={employee.id}><td className="px-3 py-3"><input aria-label={`Selecionar ${employee.fullName}`} type="checkbox" name="employeeIds" value={employee.id} checked={selected.has(employee.id)} onChange={() => toggle(employee.id)} /></td><td className="px-4 py-3"><p className="font-medium">{employee.fullName}</p><p className="text-xs text-[var(--muted-foreground)]">{employee.registration ?? "Sem matrícula"}</p></td><td className="px-4 py-3">{employmentTypeLabels[employee.employmentType]}</td><td className="px-4 py-3">{employee.unit?.name ?? "—"}</td><td className="px-4 py-3">{employee.department?.name ?? "—"}</td><td className="px-4 py-3">{employee.scheduleAssignments[0]?.scheduleTemplate.name ?? "Aguardando configuração"}</td><td className="px-4 py-3">{employeeStatusLabels[employee.status]}</td><td className="px-4 py-3">{lastPunch ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(lastPunch.occurredAt) : "—"}</td><td className="px-4 py-3"><Link className="font-semibold text-[var(--primary)]" href={employeeRoute(employee.id)}>Abrir</Link></td></tr>;
        })}</tbody></table>
      </div>
    </form>
  );
}
