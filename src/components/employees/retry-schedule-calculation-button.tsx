import { retryScheduleCalculationAction } from "@/app/(dashboard)/funcionarios/actions";

export function RetryScheduleCalculationButton({ employeeId, validFrom, validUntil }: { employeeId: string; validFrom: Date; validUntil: Date | null }) {
  return (
    <form action={retryScheduleCalculationAction} className="mb-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="validFrom" value={validFrom.toISOString().slice(0, 10)} />
      <input type="hidden" name="validUntil" value={validUntil?.toISOString().slice(0, 10) ?? ""} />
      <button className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950" type="submit">Tentar recalcular novamente</button>
    </form>
  );
}
