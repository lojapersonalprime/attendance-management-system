import { retryScheduleCalculationAction } from "@/app/(dashboard)/funcionarios/actions";
import { LoadingButton } from "@/components/ui/async-feedback";

export function RetryScheduleCalculationButton({ employeeId, validFrom, validUntil }: { employeeId: string; validFrom: Date; validUntil: Date | null }) {
  return (
    <form action={retryScheduleCalculationAction} className="mb-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="validFrom" value={validFrom.toISOString().slice(0, 10)} />
      <input type="hidden" name="validUntil" value={validUntil?.toISOString().slice(0, 10) ?? ""} />
      <LoadingButton className="border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100" loadingLabel="Recalculando registros…">Tentar recalcular novamente</LoadingButton>
    </form>
  );
}
