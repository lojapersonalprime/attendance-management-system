import type { KnownPunchCode } from "@/modules/imports/domain/types";

export interface AttendancePunchForCalculation {
  id: string;
  occurredAt: Date;
  punchCode: KnownPunchCode;
  fingerprint?: string;
}

export interface DailySchedule {
  expectedMinutes: number;
  isWorkingDay: boolean;
  expectedBreakMinutes?: number;
}

export interface MinuteAdjustment {
  id: string;
  minutesCredited: number;
  minutesDebited: number;
  status: "ACTIVE" | "CANCELLED";
}

export type CalculationInconsistencyType =
  | "MISSING_SCHEDULE"
  | "ODD_PUNCH_COUNT"
  | "MISSING_ENTRY"
  | "MISSING_EXIT"
  | "MISSING_BREAK_OUT"
  | "MISSING_BREAK_RETURN"
  | "INVALID_SEQUENCE"
  | "POSSIBLE_DUPLICATE"
  | "MULTIPLE_ENTRIES"
  | "MULTIPLE_EXITS"
  | "PUNCH_ON_DAY_OFF"
  | "INTERVAL_TOO_SHORT"
  | "INTERVAL_TOO_LONG"
  | "EXCESS_TIME_PENDING";

export interface CalculationInconsistency {
  type: CalculationInconsistencyType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  description: string;
  punchIds: string[];
}

export interface DailyCalculation {
  sortedPunches: AttendancePunchForCalculation[];
  rawWorkedMinutes: number;
  validWorkedMinutes: number;
  intervalMinutes: number;
  expectedMinutes: number;
  positiveMinutes: number;
  negativeMinutes: number;
  pendingExcessMinutes: number;
  status: "PROVISIONAL" | "NEEDS_REVIEW" | "REGULAR";
  inconsistencies: CalculationInconsistency[];
}
