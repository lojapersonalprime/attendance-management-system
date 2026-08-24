import { Clock3, Coffee, LogIn, LogOut } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE } from "@/lib/dates/business";
import { punchPresentation, type ImportedPunchCode } from "@/modules/attendance/domain/presentation";

const icons = { S: LogIn, E: Coffee, A: Clock3, F: LogOut } as const;

export function AttendanceTimeline({ punches, technical = true, waitingForRecalculation = false }: { punches: Array<{ id?: string; occurredAt: Date; punchCode: ImportedPunchCode; origin?: "RAW_PUNCH" | "MOBILE_PUNCH" | "MANUAL_ADJUSTMENT"; adjustmentId?: string; reason?: string }>; technical?: boolean; waitingForRecalculation?: boolean }) {
  if (waitingForRecalculation) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Resumo aguardando atualização. Recalcule o dia antes de consultar as marcações que sustentam o saldo.</p>;
  if (punches.length === 0) return <p className="text-sm text-[var(--muted-foreground)]">Nenhuma marcação registrada no arquivo para este dia.</p>;
  return <div className="relative space-y-4 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-slate-200">
    {[...punches].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()).map((punch) => {
      const item = punchPresentation[punch.punchCode];
      const Icon = icons[punch.punchCode];
      return <div className="relative flex items-center gap-3" key={punch.id ?? `${punch.occurredAt.toISOString()}-${punch.punchCode}`}>
        <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full bg-orange-50 text-[var(--primary)]"><Icon size={16} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="font-semibold text-slate-950">{formatInTimeZone(punch.occurredAt, BUSINESS_TIME_ZONE, "HH:mm")}</p><p className="text-sm text-[var(--muted-foreground)]">{item.label}{punch.origin === "MANUAL_ADJUSTMENT" ? " · ajuste do RH" : punch.origin === "MOBILE_PUNCH" ? " · registrado pelo celular" : ""}</p>{punch.origin === "MANUAL_ADJUSTMENT" && punch.reason ? <p className="text-xs text-[var(--muted-foreground)]">{punch.reason}</p> : null}</div>
        {technical ? <span className="ml-auto text-xs text-[var(--muted-foreground)]">{formatInTimeZone(punch.occurredAt, BUSINESS_TIME_ZONE, "HH:mm:ss")}</span> : null}
      </div>;
    })}
  </div>;
}
