import { z } from "zod";

export const employeeRemovalConfirmationSchema = z.object({
  employeeId: z.string().min(1),
  confirmationName: z.string().trim().min(3, "Digite o nome completo do funcionário para confirmar."),
});

export type EmployeeRemovalMode = "DELETE" | "PRESERVE_ONLY";

export interface EmployeeRemovalFootprint {
  status: string;
  hasMergedEmployees?: boolean;
}

export interface EmployeeRemovalDecision {
  mode: EmployeeRemovalMode;
}

/**
 * Operational deletion removes the employee and its derived records. A merged
 * record is the sole exception because merge history is an audit invariant.
 */
export function decideEmployeeRemoval(footprint: EmployeeRemovalFootprint): EmployeeRemovalDecision {
  if (footprint.status === "MERGED" || footprint.hasMergedEmployees) {
    return { mode: "PRESERVE_ONLY" };
  }
  return { mode: "DELETE" };
}
