"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function EmployeeRemovalAction({
  action,
  employeeId,
  fullName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  employeeId: string;
  fullName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const actionLabel = "Excluir funcionário";

  const openDialog = () => {
    menu.current?.removeAttribute("open");
    dialog.current?.showModal();
  };
  const closeDialog = () => {
    setConfirmationName("");
    dialog.current?.close();
  };

  return <><details className="relative" ref={menu}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]"><MoreHorizontal aria-hidden="true" size={18} />Ações</summary>
    <div className="motion-popover absolute right-0 z-20 mt-2 min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl">
      <button className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-elevated)]" onClick={openDialog} type="button"><Trash2 aria-hidden="true" size={16} />{actionLabel}</button>
    </div>
  </details><dialog aria-labelledby="employee-removal-title" className="m-auto w-[min(94vw,34rem)] rounded-[1.25rem] border p-0 shadow-2xl backdrop:bg-slate-950/65" ref={dialog}>
    <form action={action} className="grid gap-5 p-5 sm:p-6">
      <input name="employeeId" type="hidden" value={employeeId} />
      <div>
        <p className="eyebrow text-red-400">AÇÃO IRREVERSÍVEL</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-none" id="employee-removal-title">Excluir {fullName}?</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">Ao excluir este funcionário, suas horas, saldos, pendências e dados de apuração deixarão de fazer parte do sistema. Esta ação não poderá ser desfeita pela interface.</p>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">Digite <span className="rounded-md bg-[var(--surface-elevated)] px-2 py-1 font-mono text-xs text-[var(--primary)]">&quot;{fullName}&quot;</span> para confirmar<input autoComplete="off" autoFocus className="input" name="confirmationName" onChange={(event) => setConfirmationName(event.target.value)} value={confirmationName} /></label>
      <div className="flex flex-wrap justify-end gap-2"><Button onClick={closeDialog} type="button" variant="secondary">Cancelar</Button><ConfirmButton disabled={confirmationName !== fullName} label={actionLabel} /></div>
    </form>
  </dialog></>;
}

function ConfirmButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return <Button disabled={disabled || pending} type="submit" variant="danger">{pending ? "Confirmando…" : label}</Button>;
}
