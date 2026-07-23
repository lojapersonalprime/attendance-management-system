export const actionableInconsistencyStatuses = ["OPEN", "REOPENED", "IN_REVIEW"] as const;

export type ActionableInconsistencyStatus = (typeof actionableInconsistencyStatuses)[number];

export function isActionableInconsistencyStatus(value: string): value is ActionableInconsistencyStatus {
  return actionableInconsistencyStatuses.includes(value as ActionableInconsistencyStatus);
}
