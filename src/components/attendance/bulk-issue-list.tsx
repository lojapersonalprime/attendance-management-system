"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Route } from "next";
import { bulkIssueActions, isBulkIssueActionCompatible, previewBulkIssueAction, type BulkIssueAction } from "@/modules/inconsistencies/domain/bulk-actions";

const actionLabels: Record<BulkIssueAction, string> = {
  MARK_IN_REVIEW: "Marcar como em revisão",
  DISMISS_WARNING: "Dispensar com justificativa",
  JUSTIFY_ABSENCE: "Aplicar justificativa comum",
  APPROVE_EXCESS: "Aprovar excedentes compatíveis",
  RESOLVE_ALREADY_CORRECTED: "Resolver pendências já corrigidas",
  RECALCULATE_DAYS: "Recalcular dias selecionados",
};

export function BulkIssueList({
  items,
  totalFiltered,
  canManage,
  executeAction,
}: {
  items: Array<{ id: string; type: string; title: string; employee: string; employeeId: string | null; date: string; businessDate: string | null; description: string; impact: string; status: string; severity: string; reviewHref: Route }>;
  totalFiltered: number;
  canManage: boolean;
  executeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<BulkIssueAction>("MARK_IN_REVIEW");
  const [reason, setReason] = useState("");
  const [minutesApproved, setMinutesApproved] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]);
  const preview = useMemo(() => previewBulkIssueAction(action, selectedItems.map((item) => ({ id: item.id, type: item.type, employeeId: item.employeeId, date: item.businessDate }))), [action, selectedItems]);
  const compatibleItems = useMemo(() => selectedItems.filter((item) => isBulkIssueActionCompatible(action, item.type)), [action, selectedItems]);
  const incompatibleItems = preview.incompatible;
  const employeeCount = preview.employeeCount;
  const dayCount = preview.dayCount;
  const recalculations = preview.recalculationCount;
  const selectAll = () => setSelected((current) => current.length === items.length ? [] : items.map((item) => item.id));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return <form action={executeAction} className="space-y-3"><section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm"><label className="flex items-center gap-2 text-sm font-semibold"><input checked={selected.length === items.length && items.length > 0} onChange={selectAll} type="checkbox" />Selecionar todos da página</label>{totalFiltered === items.length ? <button className="text-sm font-semibold text-[var(--primary)]" type="button" onClick={() => setSelected(items.map((item) => item.id))}>Selecionar todas as {totalFiltered} pendências deste filtro</button> : <p className="text-xs text-[var(--muted-foreground)]">Há {totalFiltered} no filtro; refine-o para selecionar todas com segurança.</p>}</section>{items.map((item) => <article className="rounded-xl border bg-white p-4 shadow-sm" key={item.id}><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 gap-3">{canManage ? <input aria-label={`Selecionar ${item.title}`} checked={selected.includes(item.id)} onChange={() => toggle(item.id)} type="checkbox" /> : null}<div><h2 className="font-semibold text-slate-950">{item.title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.employee} · {item.date}</p><p className="mt-2 text-sm text-slate-700">{item.description}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">Impacto: {item.impact}</p></div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{item.severity} · {item.status}</span></div><div className="mt-4 flex flex-wrap items-center gap-2"><Link className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white" href={item.reviewHref}>Resolver pendência</Link><details><summary className="cursor-pointer px-2 py-2 text-sm font-semibold text-[var(--primary)]">Detalhes técnicos</summary><p className="mt-2 max-w-2xl text-xs text-[var(--muted-foreground)]">Tipo interno: {item.type}.</p></details></div></article>)}{canManage && selected.length > 0 ? <aside className="sticky bottom-4 z-20 rounded-xl border border-slate-300 bg-white p-4 shadow-xl"><div className="grid gap-3 lg:grid-cols-[1fr_1fr]"><div><p className="font-semibold">{selected.length} pendência(s) selecionada(s)</p><label className="mt-2 grid gap-1 text-sm font-medium">Ação em lote<select className="input" name="action" value={action} onChange={(event) => { setAction(event.target.value as BulkIssueAction); setConfirmed(false); }}>{bulkIssueActions.map((value) => <option key={value} value={value}>{actionLabels[value]}</option>)}</select></label>{action === "APPROVE_EXCESS" ? <label className="mt-2 grid gap-1 text-sm font-medium">Minutos aprovados para cada pendência compatível<input className="input" name="minutesApproved" min="1" value={minutesApproved} onChange={(event) => setMinutesApproved(event.target.value)} type="number" required /></label> : null}<label className="mt-2 grid gap-1 text-sm font-medium">Justificativa comum<textarea className="input min-h-20" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} /></label></div><div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">Prévia antes da execução</p><dl className="mt-2 grid gap-1"><div className="flex justify-between"><dt>Funcionários afetados</dt><dd>{employeeCount}</dd></div><div className="flex justify-between"><dt>Dias afetados</dt><dd>{dayCount}</dd></div><div className="flex justify-between"><dt>Pendências</dt><dd>{selected.length}</dd></div><div className="flex justify-between"><dt>Compatíveis</dt><dd>{compatibleItems.length}</dd></div><div className="flex justify-between"><dt>Incompatíveis</dt><dd>{incompatibleItems.length}</dd></div><div className="flex justify-between"><dt>Recálculos necessários</dt><dd>{recalculations}</dd></div></dl>{incompatibleItems.length > 0 ? <p className="mt-3 rounded bg-amber-50 p-2 text-amber-950">Algumas pendências precisam ser corrigidas individualmente.</p> : null}<label className="mt-3 flex items-start gap-2"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />Confirmo a ação em {compatibleItems.length} pendência(s) compatível(is).</label>{selected.map((id) => <input key={id} name="inconsistencyIds" type="hidden" value={id} />)}<button className="mt-3 rounded-md bg-[var(--primary)] px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!confirmed || compatibleItems.length === 0 || reason.trim().length < 3 || (action === "APPROVE_EXCESS" && Number(minutesApproved) <= 0)} type="submit">Executar com confirmação</button></div></div></aside> : null}</form>;
}
