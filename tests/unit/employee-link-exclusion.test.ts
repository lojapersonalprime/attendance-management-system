import { describe, expect, it } from "vitest";
import { excludedExternalEmployeeNumbers, shouldCreateProvisionalEmployee } from "@/modules/imports/domain/employee-link-exclusion";

describe("vínculo técnico de funcionário excluído", () => {
  it("não permite que a importação recrie cadastro provisório para o mesmo dispositivo/EnNo", () => {
    const excluded = excludedExternalEmployeeNumbers([
      { externalEmployeeNumber: "0017", employeeId: null },
      { externalEmployeeNumber: "0018", employeeId: "employee-active" },
    ]);

    expect(shouldCreateProvisionalEmployee(excluded, "0017")).toBe(false);
    expect(shouldCreateProvisionalEmployee(excluded, "0018")).toBe(true);
  });
});
