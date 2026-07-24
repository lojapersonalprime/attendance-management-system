import { describe, expect, it } from "vitest";
import { isBulkIssueActionCompatible, previewBulkIssueAction } from "@/modules/inconsistencies/domain/bulk-actions";

describe("ações em lote para pendências", () => {
  const candidates = [
    { id: "excess", type: "EXCESS_TIME_PENDING", employeeId: "employee-a", date: "2026-07-10" },
    { id: "absence", type: "NO_PUNCHES_ON_SCHEDULED_DAY", employeeId: "employee-a", date: "2026-07-11" },
    { id: "missing-exit", type: "MISSING_EXIT", employeeId: "employee-b", date: "2026-07-10" },
  ];

  it("permite somente excedentes compatíveis para aprovação comum", () => {
    expect(isBulkIssueActionCompatible("APPROVE_EXCESS", "EXCESS_TIME_PENDING")).toBe(true);
    expect(isBulkIssueActionCompatible("APPROVE_EXCESS", "MISSING_EXIT")).toBe(false);
    const preview = previewBulkIssueAction("APPROVE_EXCESS", candidates);
    expect(preview.compatible.map((item) => item.id)).toEqual(["excess"]);
    expect(preview.incompatible).toHaveLength(2);
    expect(preview.recalculationCount).toBe(1);
  });

  it("permite revisão em lote e apresenta impacto por funcionário e dia", () => {
    const preview = previewBulkIssueAction("MARK_IN_REVIEW", candidates);
    expect(preview.compatible).toHaveLength(3);
    expect(preview.incompatible).toHaveLength(0);
    expect(preview.employeeCount).toBe(2);
    expect(preview.dayCount).toBe(3);
    expect(preview.recalculationCount).toBe(0);
  });

  it("não oferece correção fictícia de marcações como ação em lote", () => {
    expect(isBulkIssueActionCompatible("JUSTIFY_ABSENCE", "MISSING_EXIT")).toBe(true);
    expect(isBulkIssueActionCompatible("JUSTIFY_ABSENCE", "POSSIBLE_DUPLICATE")).toBe(false);
  });
});
