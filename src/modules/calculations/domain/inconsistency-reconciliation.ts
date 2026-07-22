import { createHash } from "node:crypto";
import type { EngineInconsistency } from "@/modules/calculations/domain/calculation-engine";

export interface ExistingCalculationInconsistency {
  id: string;
  logicalKey: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED" | "AUTO_RESOLVED" | "REOPENED";
}

export function calculationInconsistencyLogicalKey(input: {
  employeeId: string;
  businessDate: string;
  issue: EngineInconsistency;
  calculationVersion: string;
}) {
  const context = Object.entries(input.issue.context).sort(([left], [right]) => left.localeCompare(right));
  const digest = createHash("sha256").update(JSON.stringify(context)).digest("hex").slice(0, 20);
  return `${input.employeeId}|${input.businessDate}|${input.issue.type}|${input.calculationVersion}|${digest}`;
}

export function reconcileInconsistencyStatus(previous: ExistingCalculationInconsistency | undefined, present: boolean) {
  if (!present) return previous && !["RESOLVED", "DISMISSED"].includes(previous.status) ? "AUTO_RESOLVED" as const : undefined;
  if (!previous) return "OPEN" as const;
  return previous.status === "AUTO_RESOLVED" ? "REOPENED" as const : previous.status === "DISMISSED" || previous.status === "RESOLVED" ? previous.status : "OPEN" as const;
}
