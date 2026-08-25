"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { employeeRoute } from "@/lib/routes";
import { StatusBadge } from "@/components/ui/status-badge";
import { employeeStatusLabels, employmentTypeLabels, employmentTypes } from "@/modules/employees/domain/validation";

interface Option { id: string; name: string }

interface EmployeeRow {
  id: string;
  fullName: string;
  employmentType: keyof typeof employmentTypeLabels;
  status: keyof typeof employeeStatusLabels;
  provisional: boolean;
  unit: { name: string } | null;
  department: { name: string } | null;
  position: { name: string } | null;
  deviceLinks: Array<{ externalEmployeeNumber: string; active: boolean; rawPunches: Array<{ occurredAt: Date }> }>;
  scheduleAssignments: Array<{ scheduleTemplate: { name: string } }>;
}

type BulkAction = "EMPLOYMENT_TYPE" | "UNIT" | "DEPARTMENT" | "POSITION" | "SCHEDULE" | "STATUS" | "RECALCULATE";

const actionLabels: Record<BulkAction, string> = {
  EMPLOYMENT_TYPE: "Definir tipo de vínculo",
  UNIT: "Definir unidade",
  DEPARTMENT: "Definir setor",
  POSITION: "Definir cargo",
  SCHEDULE: "Atribuir jornada",
  STATUS: "Alterar status",
  RECALCULATE: "Solicitar recálculo",
};

export function EmployeeBulkList({ action, employees, units, departments, positions, schedules }: {
  action: (formData: FormData) => void | Promise<void>;
  employees: EmployeeRow[];
  units: Option[];
  departments: Option[];
  positions: Option[];
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
    return [];
  }, [bulkAction, departments, positions, units]);
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(employees.map((employee) => employee.id)));

  return (
    <form action={action} className="space-y-4">
      {[...selected].map((id) => <input key={id} name="employeeIds" type="hidden" value={id} />)}
      {selectedCount > 0 ? <section className="surface-highlight grid gap-3 rounded-[1.5rem] p-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"><div className="lg:col-span-4"><p className="eyebrow text-[var(--primary)]">AÇÃO EM LOTE</p><p className="font-display mt-1 text-2xl font-semibold leading-none">{selectedCount} funcionário(s) selecionado(s)</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">Escolha uma ação para continuar. O motivo será solicitado apenas quando necessário.</p></div>
        <label className="grid gap-1 text-sm font-medium">Escolher ação<select className="input" name="bulkAction" value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction | "")}><option value="">Selecione</option>{(Object.keys(actionLabels) as BulkAction[]).map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}</select></label>
        {bulkAction === "EMPLOYMENT_TYPE" ? <label className="grid gap-1 text-sm font-medium">Tipo de vínculo<select className="input" name="bulkValue">{employmentTypes.map((type) => <option key={type} value={type}>{employmentTypeLabels[type]}</option>)}</select></label> : null}
        {bulkAction === "STATUS" ? <label className="grid gap-1 text-sm font-medium">Status<select className="input" name="bulkValue">{(["ACTIVE", "ON_LEAVE", "VACATION", "INACTIVE", "TERMINATED"] as const).map((status) => <option key={status} value={status}>{employeeStatusLabels[status]}</option>)}</select></label> : null}
        {bulkAction === "STATUS" ? <label className="grid gap-1 text-sm font-medium">Data de desligamento<input className="input" type="date" name="terminationDate" /></label> : null}
        {currentOptions.length > 0 ? <label className="grid gap-1 text-sm font-medium">Valor<select className="input" name="bulkValue"><option value="">Selecione</option>{currentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
        {bulkAction === "SCHEDULE" ? <label className="grid gap-1 text-sm font-medium">Jornada<select className="input" name="scheduleTemplateId"><option value="">Selecione</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}</select></label> : null}
        {(bulkAction === "SCHEDULE" || bulkAction === "RECALCULATE") ? <><label className="grid gap-1 text-sm font-medium">Data inicial<input className="input" type="date" name="validFrom" /></label><label className="grid gap-1 text-sm font-medium">Data final<input className="input" type="date" name="validUntil" /></label></> : null}
        {bulkAction === "SCHEDULE" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="closePrevious" />Encerrar jornada anterior</label> : null}
        {bulkAction === "SCHEDULE" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="retroactiveConfirmed" />Confirmar vigência retroativa</label> : null}
        <label className="grid gap-1 text-sm font-medium lg:col-span-2">Motivo{["SCHEDULE", "STATUS", "RECALCULATE"].includes(bulkAction) ? " *" : ""}<input className="input" name="reason" placeholder="Obrigatório em ações críticas" /></label>
        <button className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!bulkAction}>Aplicar em {selectedCount} selecionado(s)</button>
      </section> : null}
      <div className="space-y-3 lg:hidden">
        {employees.map((employee) => {
          const lastPunch = employee.deviceLinks.flatMap((link) => link.rawPunches).sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
          return <article className="surface rounded-[1.25rem] p-4" key={employee.id}><div className="flex items-start gap-3"><input aria-label={`Selecionar ${employee.fullName}`} className="mt-1" type="checkbox" checked={selected.has(employee.id)} onChange={() => toggle(employee.id)} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-semibold text-[var(--foreground)]">{employee.fullName}</p><StatusBadge tone={employee.status === "ACTIVE" ? "success" : employee.status === "INACTIVE" || employee.status === "TERMINATED" ? "neutral" : "warning"}>{employeeStatusLabels[employee.status]}</StatusBadge></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><Info label="Unidade" value={employee.unit?.name ?? "—"} /><Info label="Jornada" value={employee.scheduleAssignments[0]?.scheduleTemplate.name ?? "Sem modelo"} /><Info label="Vínculo" value={employmentTypeLabels[employee.employmentType]} /><Info label="Última marcação" value={lastPunch ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(lastPunch.occurredAt) : "—"} /></dl><Link className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary)]" href={employeeRoute(employee.id)}>Abrir cadastro →</Link></div></div></article>;
        })}
      </div>
      <div className="admin-table-surface hidden overflow-x-auto rounded-[1.25rem] lg:block">
        <table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-3 py-3"><input aria-label="Selecionar todos desta página" type="checkbox" checked={allSelected} onChange={toggleAll} /></th><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Vínculo</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Jornada</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Última marcação</th><th className="px-4 py-3">Ações</th></tr></thead><tbody>{employees.map((employee) => {
          const lastPunch = employee.deviceLinks.flatMap((link) => link.rawPunches).sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
          return <tr className="border-b last:border-0" key={employee.id}><td className="px-3 py-3"><input aria-label={`Selecionar ${employee.fullName}`} type="checkbox" checked={selected.has(employee.id)} onChange={() => toggle(employee.id)} /></td><td className="px-4 py-3"><p className="font-medium">{employee.fullName}</p></td><td className="px-4 py-3">{employmentTypeLabels[employee.employmentType]}</td><td className="px-4 py-3">{employee.unit?.name ?? "—"}</td><td className="px-4 py-3">{employee.department?.name ?? "—"}</td><td className="px-4 py-3">{employee.scheduleAssignments[0]?.scheduleTemplate.name ?? "Sem modelo"}</td><td className="px-4 py-3"><StatusBadge tone={employee.status === "ACTIVE" ? "success" : employee.status === "INACTIVE" || employee.status === "TERMINATED" ? "neutral" : "warning"}>{employeeStatusLabels[employee.status]}</StatusBadge></td><td className="px-4 py-3">{lastPunch ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(lastPunch.occurredAt) : "—"}</td><td className="px-4 py-3"><Link className="font-semibold text-[var(--primary)]" href={employeeRoute(employee.id)}>Abrir</Link></td></tr>;
        })}</tbody></table>
      </div>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="eyebrow text-[var(--muted-foreground)]">{label}</dt><dd className="mt-1 truncate text-xs text-[var(--foreground)]">{value}</dd></div>;
}
