import { z } from "zod";

export const employeeRemovalConfirmationSchema = z.object({
  employeeId: z.string().min(1),
  confirmationName: z.string().trim().min(3, "Digite o nome completo do funcionário para confirmar."),
});

export type EmployeeRemovalMode = "DELETE" | "ARCHIVE" | "PRESERVE_ONLY";

export interface EmployeeRemovalFootprint {
  status: string;
  mobileAccess: boolean;
  relatedRecords: number;
}

export interface EmployeeRemovalDecision {
  mode: EmployeeRemovalMode;
  hasHistoricalData: boolean;
  deactivatesMobileAccess: boolean;
}

/**
 * Any persisted relationship is treated as part of the employee's operational
 * history. This deliberately makes hard deletion the exception: a record is
 * only removed when it has never been used or configured elsewhere.
 */
export function decideEmployeeRemoval(footprint: EmployeeRemovalFootprint): EmployeeRemovalDecision {
  if (footprint.status === "MERGED") {
    return { mode: "PRESERVE_ONLY", hasHistoricalData: true, deactivatesMobileAccess: false };
  }
  if (footprint.mobileAccess || footprint.relatedRecords > 0) {
    return { mode: "ARCHIVE", hasHistoricalData: true, deactivatesMobileAccess: footprint.mobileAccess };
  }
  return { mode: "DELETE", hasHistoricalData: false, deactivatesMobileAccess: false };
}
