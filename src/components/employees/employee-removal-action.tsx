"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { EmployeeRemovalMode } from "@/modules/employees/domain/removal";

export function EmployeeRemovalAction({
  action,
  employeeId,
  fullName,
  mode,
  hasMobileAccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  employeeId: string;
  fullName: string;
  mode: Exclude<EmployeeRemovalMode, "PRESERVE_ONLY">;
  hasMobileAccess: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const isArchive = mode === "ARCHIVE";
  const actionLabel = isArchive ? "Desativar cadastro" : "Excluir funcionário";

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
        <p className={`eyebrow ${isArchive ? "text-[var(--primary)]" : "text-red-400"}`}>{isArchive ? "PRESERVAR HISTÓRICO" : "AÇÃO IRREVERSÍVEL"}</p>
        <h2 className="font-display mt-2 text-3xl font-semibold leading-none" id="employee-removal-title">{isArchive ? "Desativar cadastro?" : "Excluir funcionário?"}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{isArchive ? "Este funcionário possui registros de ponto e não pode ter o histórico apagado. Você pode desativar o cadastro para impedir novos registros." : `Esta ação removerá o cadastro de ${fullName}. Como não há vínculos, jornadas ou registros associados, a exclusão é segura.`}</p>
        {isArchive && hasMobileAccess ? <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-sm leading-5 text-[var(--muted-foreground)]">O acesso ao ponto pelo celular será desativado. A conta de autenticação não será apagada.</p> : null}
      </div>
      <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">Para confirmar, digite <span className="rounded-md bg-[var(--surface-elevated)] px-2 py-1 font-mono text-xs text-[var(--primary)]">{fullName}</span><input autoComplete="off" autoFocus className="input" name="confirmationName" onChange={(event) => setConfirmationName(event.target.value)} value={confirmationName} /></label>
      <div className="flex flex-wrap justify-end gap-2"><Button onClick={closeDialog} type="button" variant="secondary">Cancelar</Button><ConfirmButton danger={!isArchive} disabled={confirmationName !== fullName} label={actionLabel} /></div>
    </form>
  </dialog></>;
}

function ConfirmButton({ disabled, label, danger }: { disabled: boolean; label: string; danger: boolean }) {
  const { pending } = useFormStatus();
  return <Button disabled={disabled || pending} type="submit" variant={danger ? "danger" : "primary"}>{pending ? "Confirmando…" : label}</Button>;
}
