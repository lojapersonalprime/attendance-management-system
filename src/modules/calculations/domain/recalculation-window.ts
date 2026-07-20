export function requiresRetroactiveConfirmation(validFrom: string, today: string): boolean {
  return validFrom < today;
}

export function excludeClosedMonths(dates: readonly string[], closedMonths: readonly string[]): string[] {
  const closed = new Set(closedMonths);
  return [...new Set(dates)].filter((date) => !closed.has(`${date.slice(0, 7)}-01`)).sort();
}
