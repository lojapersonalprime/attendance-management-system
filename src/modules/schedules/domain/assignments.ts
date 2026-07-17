export interface ScheduleAssignmentWindow<T extends string = string> {
  id: T;
  validFrom: string;
  validUntil?: string | null;
}

/** Dates use YYYY-MM-DD so comparison is timezone-independent and inclusive. */
export function assignmentAppliesOn<T extends string>(
  assignment: ScheduleAssignmentWindow<T>,
  businessDate: string,
): boolean {
  return (
    assignment.validFrom <= businessDate &&
    (assignment.validUntil === null || assignment.validUntil === undefined || assignment.validUntil >= businessDate)
  );
}

export function selectScheduleAssignment<T extends string>(
  assignments: readonly ScheduleAssignmentWindow<T>[],
  businessDate: string,
): ScheduleAssignmentWindow<T> | undefined {
  return [...assignments]
    .filter((assignment) => assignmentAppliesOn(assignment, businessDate))
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom))[0];
}

export function hasOverlappingScheduleAssignment<T extends string>(
  assignments: readonly ScheduleAssignmentWindow<T>[],
  candidate: ScheduleAssignmentWindow<T>,
): boolean {
  const candidateEnd = candidate.validUntil ?? "9999-12-31";
  return assignments.some((assignment) => {
    if (assignment.id === candidate.id) return false;
    const end = assignment.validUntil ?? "9999-12-31";
    return assignment.validFrom <= candidateEnd && candidate.validFrom <= end;
  });
}
