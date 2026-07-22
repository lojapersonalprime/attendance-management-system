export interface EmploymentPeriodForSelection {
  id: string;
  employmentType: "EMPLOYEE" | "INTERN" | "APPRENTICE" | "CONTRACTOR" | "OTHER";
  calculationPolicyId?: string | null;
  validFrom: string;
  validUntil?: string | null;
  status?: "ACTIVE" | "ENDED" | "CANCELLED";
}

export interface EmploymentPeriodSelection {
  period: EmploymentPeriodForSelection | null;
  overlapping: EmploymentPeriodForSelection[];
}

export function selectEmploymentPeriodForDate(
  periods: readonly EmploymentPeriodForSelection[],
  businessDate: string,
): EmploymentPeriodSelection {
  const overlapping = periods
    .filter((period) => period.status !== "CANCELLED" && period.validFrom <= businessDate && (!period.validUntil || period.validUntil >= businessDate))
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom));
  return { period: overlapping[0] ?? null, overlapping };
}

export function assertEmploymentPeriodRange(validFrom: string, validUntil?: string | null) {
  if (validUntil && validUntil < validFrom) throw new Error("O fim do vínculo não pode ser anterior ao início.");
}

export interface MonthlySegmentInput {
  businessDate: string;
  employmentPeriodId?: string | null;
  employmentType?: EmploymentPeriodForSelection["employmentType"] | null;
  calculationPolicyId?: string | null;
  policyName?: string | null;
  expectedMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  pendingExcessMinutes: number;
  negativeMinutes: number;
}

export interface MonthlySegment {
  employmentPeriodId: string | null;
  employmentType: EmploymentPeriodForSelection["employmentType"] | null;
  calculationPolicyId: string | null;
  policyName: string | null;
  dateFrom: string;
  dateTo: string;
  expectedMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  pendingExcessMinutes: number;
  negativeMinutes: number;
}

/** Groups the month by historical context; incompatible policies never share a balance. */
export function segmentMonthlySummaries(items: readonly MonthlySegmentInput[]): MonthlySegment[] {
  const segments = new Map<string, MonthlySegment>();
  for (const item of [...items].sort((left, right) => left.businessDate.localeCompare(right.businessDate))) {
    const key = `${item.employmentPeriodId ?? "missing"}|${item.calculationPolicyId ?? "missing"}`;
    const segment = segments.get(key) ?? {
      employmentPeriodId: item.employmentPeriodId ?? null,
      employmentType: item.employmentType ?? null,
      calculationPolicyId: item.calculationPolicyId ?? null,
      policyName: item.policyName ?? null,
      dateFrom: item.businessDate,
      dateTo: item.businessDate,
      expectedMinutes: 0,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyDepartureMinutes: 0,
      pendingExcessMinutes: 0,
      negativeMinutes: 0,
    };
    segment.dateFrom = segment.dateFrom < item.businessDate ? segment.dateFrom : item.businessDate;
    segment.dateTo = segment.dateTo > item.businessDate ? segment.dateTo : item.businessDate;
    segment.expectedMinutes += item.expectedMinutes;
    segment.workedMinutes += item.workedMinutes;
    segment.lateMinutes += item.lateMinutes;
    segment.earlyDepartureMinutes += item.earlyDepartureMinutes;
    segment.pendingExcessMinutes += item.pendingExcessMinutes;
    segment.negativeMinutes += item.negativeMinutes;
    segments.set(key, segment);
  }
  return [...segments.values()].sort((left, right) => left.dateFrom.localeCompare(right.dateFrom));
}
