export type CalculationPresentationState = "CALCULATED" | "PENDING_CONTEXT" | "INCOMPLETE" | "FAILED" | "NOT_APPLICABLE";

export interface CalculationPresentationInput {
  calculationMemory: unknown;
  calculationEngineVersion: string | null;
  scheduleAssignmentId: string | null;
  employmentPeriodId: string | null;
  calculationPolicyId: string | null;
  calculationRunStatus?: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL" | "FAILED" | null;
  inconsistencyTypes: readonly string[];
}

const incompleteTypes = new Set(["INCOMPLETE_DAY", "ODD_PUNCH_COUNT", "MISSING_ENTRY", "MISSING_EXIT", "MISSING_BREAK_OUT", "MISSING_BREAK_RETURN", "INVALID_SEQUENCE"]);

/**
 * A stored numeric zero is meaningful only after the calculation context and
 * engine memory exist. This keeps the HR interface from presenting blocked
 * legacy summaries as a confirmed 0h result.
 */
export function getCalculationPresentationState(input: CalculationPresentationInput): CalculationPresentationState {
  if (input.calculationRunStatus === "FAILED") return "FAILED";
  if (!input.calculationMemory || !input.calculationEngineVersion || !input.scheduleAssignmentId || !input.employmentPeriodId || !input.calculationPolicyId) {
    return "PENDING_CONTEXT";
  }
  if (input.inconsistencyTypes.some((type) => incompleteTypes.has(type))) return "INCOMPLETE";
  return "CALCULATED";
}

export function getCalculationPresentationLabel(state: CalculationPresentationState) {
  switch (state) {
    case "CALCULATED": return "Calculado";
    case "PENDING_CONTEXT": return "Cálculo pendente";
    case "INCOMPLETE": return "Dia incompleto";
    case "FAILED": return "Falha no cálculo — tentar novamente";
    case "NOT_APPLICABLE": return "Não se aplica";
  }
}
