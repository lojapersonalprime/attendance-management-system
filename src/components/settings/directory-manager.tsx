"use client";

import Link from "next/link";
import { Building2, MoreHorizontal, Pencil, Plus, Tags } from "lucide-react";
import { useRef, useState } from "react";
import { LoadingButton } from "@/components/ui/async-feedback";

export type DirectoryKind = "UNIT" | "DEPARTMENT" | "POSITION" | "TAG";

interface Entry {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  linkedEmployees: number;
}

const copy: Record<DirectoryKind, { title: string; singular: string; emptyTitle: string; activeLabel: string; inactiveLabel: string; description: string; empty: string }> = {
  UNIT: { title: "Unidades", singular: "unidade", emptyTitle: "Nenhuma unidade cadastrada", activeLabel: "Ativa", inactiveLabel: "Inativa", description: "Cadastre os locais ou filiais onde os funcionários estão vinculados.", empty: "Cadastre unidades para organizar onde os funcionários trabalham." },
  DEPARTMENT: { title: "Setores", singular: "setor", emptyTitle: "Nenhum setor cadastrado", activeLabel: "Ativo", inactiveLabel: "Inativo", description: "Crie setores para organizar os funcionários por área da empresa.", empty: "Crie setores para organizar os funcionários por área da empresa." },
  POSITION: { title: "Cargos", singular: "cargo", emptyTitle: "Nenhum cargo cadastrado", activeLabel: "Ativo", inactiveLabel: "Inativo", description: "Mantenha os cargos usados nos cadastros profissionais.", empty: "Cadastre cargos para completar os dados profissionais dos funcionários." },
  TAG: { title: "Tags", singular: "tag", emptyTitle: "Nenhuma tag cadastrada", activeLabel: "Ativa", inactiveLabel: "Inativa", description: "Use tags para agrupamentos e filtros rápidos de pessoas.", empty: "Crie tags para organizar filtros e grupos de funcionários." },
};

export function DirectoryManager({ kind, entries, canManage, action }: { kind: DirectoryKind; entries: Entry[]; canManage: boolean; action: (formData: FormData) => void | Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<Entry>();
  const content = copy[kind];
  const open = (entry?: Entry) => {
    setEditing(entry);
    dialog.current?.showModal();
  };

  return <section aria-labelledby={`${kind}-title`} className="rounded-xl border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Estrutura da empresa</p><h1 className="mt-1 text-2xl font-bold tracking-tight" id={`${kind}-title`}>{content.title}</h1><p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">{content.description}</p></div>{canManage ? <button className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" onClick={() => open()} type="button"><Plus size={16} aria-hidden="true" />Adicionar {content.singular}</button> : null}</div>
    {entries.length === 0 ? <div className="mt-7 grid min-h-56 place-items-center rounded-xl border border-dashed bg-slate-50 p-6 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-[var(--primary)] shadow-sm">{kind === "UNIT" ? <Building2 size={20} aria-hidden="true" /> : <Tags size={20} aria-hidden="true" />}</span><h2 className="mt-4 font-semibold">{content.emptyTitle}</h2><p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted-foreground)]">{content.empty}</p>{canManage ? <button className="mt-4 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" onClick={() => open()} type="button">Adicionar {content.singular}</button> : null}</div></div> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-3 py-3">Nome</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Funcionários vinculados</th><th className="px-3 py-3">Situação</th><th className="px-3 py-3"><span className="sr-only">Ações</span></th></tr></thead><tbody>{entries.map((entry) => <tr className="border-b last:border-0" key={entry.id}><td className="px-3 py-4 font-semibold text-slate-900">{entry.name}</td><td className="px-3 py-4 text-[var(--muted-foreground)]">{entry.description || "Sem descrição"}</td><td className="px-3 py-4">{entry.linkedEmployees} {entry.linkedEmployees === 1 ? "funcionário" : "funcionários"}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{entry.active ? content.activeLabel : content.inactiveLabel}</span></td><td className="px-3 py-4 text-right"><details className="relative inline-block"><summary aria-label={`Ações de ${entry.name}`} className="inline-flex cursor-pointer list-none rounded-md border p-2 hover:bg-slate-50"><MoreHorizontal size={16} aria-hidden="true" /></summary><div className="absolute right-0 z-10 mt-2 grid min-w-40 rounded-lg border bg-white p-1 text-left shadow-lg"><button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-slate-50" onClick={() => open(entry)} type="button"><Pencil size={14} aria-hidden="true" />Editar</button><Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-50" href="/funcionarios">Ver funcionários</Link></div></details></td></tr>)}</tbody></table></div>}
    <dialog aria-labelledby="directory-dialog-title" className="m-auto w-[min(94vw,560px)] rounded-xl border p-0 shadow-2xl backdrop:bg-slate-950/40" ref={dialog}><form action={action} className="grid gap-4 p-5"><input name="kind" type="hidden" value={kind} /><input name="returnTo" type="hidden" value="/configuracoes/estrutura" />{editing ? <input name="id" type="hidden" value={editing.id} /> : null}<div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Estrutura da empresa</p><h2 className="mt-1 text-lg font-semibold" id="directory-dialog-title">{editing ? `Editar ${content.singular}` : `Adicionar ${content.singular}`}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">As alterações ficam registradas para consulta do RH.</p></div><label className="grid gap-1 text-sm font-medium">Nome<input autoFocus className="input" defaultValue={editing?.name ?? ""} name="name" required /></label><label className="grid gap-1 text-sm font-medium">Descrição <span className="font-normal text-[var(--muted-foreground)]">(opcional)</span><textarea className="input min-h-24" defaultValue={editing?.description ?? ""} name="description" /></label><label className="grid gap-1 text-sm font-medium">Situação<select className="input" defaultValue={String(editing?.active ?? true)} name="active"><option value="true">Ativa</option><option value="false">Inativa</option></select></label><label className="grid gap-1 text-sm font-medium">Justificativa <span className="font-normal text-[var(--muted-foreground)]">(obrigatória ao inativar)</span><textarea className="input min-h-20" name="reason" placeholder="Explique a alteração quando necessário." /></label><div className="flex flex-wrap justify-end gap-2"><button className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={() => dialog.current?.close()} type="button">Cancelar</button><LoadingButton loadingLabel={`Salvando ${content.singular}…`}>{editing ? `Salvar ${content.singular}` : `Adicionar ${content.singular}`}</LoadingButton></div></form></dialog>
  </section>;
}
