import { Clock3, Coffee, LogIn, LogOut } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIME_ZONE } from "@/lib/dates/business";
import { punchPresentation, type ImportedPunchCode } from "@/modules/attendance/domain/presentation";

const icons = { S: LogIn, E: Coffee, A: Clock3, F: LogOut } as const;

export function AttendanceTimeline({ punches, technical = true }: { punches: Array<{ occurredAt: Date; punchCode: ImportedPunchCode }>; technical?: boolean }) {
  if (punches.length === 0) return <p className="text-sm text-[var(--muted-foreground)]">Nenhuma marcação registrada no arquivo para este dia.</p>;
  return <div className="relative space-y-4 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-slate-200">
    {[...punches].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime()).map((punch) => {
      const item = punchPresentation[punch.punchCode];
      const Icon = icons[punch.punchCode];
      return <div className="relative flex items-center gap-3" key={`${punch.occurredAt.toISOString()}-${punch.punchCode}`}>
        <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full bg-orange-50 text-[var(--primary)]"><Icon size={16} aria-hidden="true" /></span>
        <div className="min-w-0"><p className="font-semibold text-slate-950">{formatInTimeZone(punch.occurredAt, BUSINESS_TIME_ZONE, "HH:mm")}</p><p className="text-sm text-[var(--muted-foreground)]">{item.label}</p></div>
        {technical ? <span className="ml-auto text-xs text-[var(--muted-foreground)]">{formatInTimeZone(punch.occurredAt, BUSINESS_TIME_ZONE, "HH:mm:ss")}</span> : null}
      </div>;
    })}
  </div>;
}
