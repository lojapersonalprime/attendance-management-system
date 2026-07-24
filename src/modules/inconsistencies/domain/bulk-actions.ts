export const bulkIssueActions = [
  "MARK_IN_REVIEW",
  "DISMISS_WARNING",
  "JUSTIFY_ABSENCE",
  "APPROVE_EXCESS",
  "RESOLVE_ALREADY_CORRECTED",
  "RECALCULATE_DAYS",
] as const;

export type BulkIssueAction = (typeof bulkIssueActions)[number];

export interface BulkIssueCandidate {
  id: string;
  type: string;
  employeeId: string | null;
  date: string | null;
}

export function isBulkIssueActionCompatible(action: BulkIssueAction, type: string) {
  if (["MARK_IN_REVIEW", "RECALCULATE_DAYS", "RESOLVE_ALREADY_CORRECTED"].includes(action)) return true;
  if (action === "DISMISS_WARNING") return ["PUNCH_OUTSIDE_SCHEDULE", "POSSIBLE_DUPLICATE", "LATE_ARRIVAL", "EARLY_DEPARTURE", "EXCESS_TIME_PENDING", "INTERVAL_TOO_SHORT", "INTERVAL_TOO_LONG"].includes(type);
  if (action === "JUSTIFY_ABSENCE") return ["NO_PUNCHES_ON_SCHEDULED_DAY", "MISSING_ENTRY", "MISSING_EXIT", "INCOMPLETE_DAY"].includes(type);
  return action === "APPROVE_EXCESS" && type === "EXCESS_TIME_PENDING";
}

/** A pure preview shared by the UI and service; execution validates it again against current data. */
export function previewBulkIssueAction(action: BulkIssueAction, candidates: readonly BulkIssueCandidate[]) {
  const compatible = candidates.filter((candidate) => isBulkIssueActionCompatible(action, candidate.type));
  const incompatible = candidates.filter((candidate) => !isBulkIssueActionCompatible(action, candidate.type)).map((candidate) => ({ id: candidate.id, type: candidate.type, reason: "O tipo de pendência exige tratamento individual para esta ação." }));
  return {
    compatible,
    incompatible,
    employeeCount: new Set(compatible.flatMap((candidate) => candidate.employeeId ? [candidate.employeeId] : [])).size,
    dayCount: new Set(compatible.flatMap((candidate) => candidate.employeeId && candidate.date ? [`${candidate.employeeId}|${candidate.date}`] : [])).size,
    recalculationCount: ["JUSTIFY_ABSENCE", "APPROVE_EXCESS", "RESOLVE_ALREADY_CORRECTED", "RECALCULATE_DAYS"].includes(action) ? compatible.length : 0,
  };
}
