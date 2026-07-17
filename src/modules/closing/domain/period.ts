export function canClosePeriod(hasOpenCriticalInconsistencies: boolean): boolean {
  return !hasOpenCriticalInconsistencies;
}

export function assertPeriodCanBeChanged(status: "OPEN" | "CLOSED"): void {
  if (status === "CLOSED") {
    throw new Error("A competência está fechada e não pode receber alteração normal.");
  }
}
