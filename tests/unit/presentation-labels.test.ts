import { describe, expect, it } from "vitest";
import { getAuditActionLabel, getCalculationRunStatusLabel, getEntityTypeLabel, getInconsistencyStatusLabel, getInconsistencyTypeLabel, getSeverityLabel } from "@/lib/presentation/labels";

describe("rótulos da interface", () => {
  it("traduz ações e entidades de auditoria", () => {
    expect(getAuditActionLabel("BULK_EMPLOYEE_ACTION_COMPLETED")).toBe("Ação em lote concluída");
    expect(getAuditActionLabel("EMPLOYEE_UNIT_CHANGED")).toBe("Unidade do funcionário alterada");
    expect(getEntityTypeLabel("EmployeeBulkAction")).toBe("Ação em lote de funcionários");
    expect(getEntityTypeLabel("ScheduleTemplate")).toBe("Jornada");
  });

  it("traduz estados e inconsistências sem expor enums", () => {
    expect(getCalculationRunStatusLabel("PARTIAL")).toBe("Concluído com pendências");
    expect(getInconsistencyTypeLabel("MISSING_SCHEDULE")).toBe("Jornada não informada");
    expect(getInconsistencyStatusLabel("AUTO_RESOLVED")).toBe("Resolvida automaticamente");
    expect(getSeverityLabel("CRITICAL")).toBe("Crítica");
  });
});
