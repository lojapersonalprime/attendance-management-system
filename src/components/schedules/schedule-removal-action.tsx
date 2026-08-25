"use client";

import { Trash2 } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function ScheduleRemovalAction({
  action,
  scheduleId,
  scheduleName,
  linkedEmployees,
}: {
  action: (formData: FormData) => void | Promise<void>;
  scheduleId: string;
  scheduleName: string;
  linkedEmployees: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return <><button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50" onClick={() => dialog.current?.showModal()} type="button"><Trash2 aria-hidden="true" size={16} />Excluir modelo de horário</button>
    <dialog aria-labelledby="schedule-removal-title" className="m-auto w-[min(94vw,34rem)] rounded-[1.25rem] border p-0 shadow-2xl backdrop:bg-slate-950/65" ref={dialog}>
      <form action={action} className="grid gap-5 p-5 sm:p-6">
        <input name="id" type="hidden" value={scheduleId} />
        <div>
          <p className="eyebrow text-red-500">REMOVER DO CATÁLOGO</p>
          <h2 className="font-display mt-2 text-3xl font-semibold leading-none" id="schedule-removal-title">Excluir modelo &quot;{scheduleName}&quot;?</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">O modelo deixará de aparecer nas opções do RH. As marcações e o histórico dos funcionários serão preservados.</p>
          {linkedEmployees > 0 ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">Este modelo está vinculado a {linkedEmployees} funcionário{linkedEmployees === 1 ? "" : "s"}. Ao excluí-lo, {linkedEmployees === 1 ? "ele ficará" : "eles ficarão"} sem modelo de horário até receber{linkedEmployees === 1 ? " outro" : "em outro"}.</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2"><Button onClick={close} type="button" variant="secondary">Cancelar</Button><RemoveButton /></div>
      </form>
    </dialog>
  </>;
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending} type="submit" variant="danger">{pending ? "Excluindo…" : "Excluir mesmo assim"}</Button>;
}
