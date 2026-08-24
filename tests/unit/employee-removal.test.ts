import { describe, expect, it } from "vitest";
import { decideEmployeeRemoval, employeeRemovalConfirmationSchema } from "@/modules/employees/domain/removal";

describe("remoção segura de funcionário", () => {
  it("permite exclusão definitiva somente para cadastro sem histórico nem relações", () => {
    expect(decideEmployeeRemoval({ status: "ACTIVE", mobileAccess: false, relatedRecords: 0 })).toEqual({
      mode: "DELETE",
      hasHistoricalData: false,
      deactivatesMobileAccess: false,
    });
  });

  it("arquiva o cadastro quando há histórico de apuração", () => {
    expect(decideEmployeeRemoval({ status: "ACTIVE", mobileAccess: false, relatedRecords: 1 })).toEqual({
      mode: "ARCHIVE",
      hasHistoricalData: true,
      deactivatesMobileAccess: false,
    });
  });

  it("arquiva e desativa o acesso mobile sem apagar a conta de autenticação", () => {
    expect(decideEmployeeRemoval({ status: "ACTIVE", mobileAccess: true, relatedRecords: 0 })).toEqual({
      mode: "ARCHIVE",
      hasHistoricalData: true,
      deactivatesMobileAccess: true,
    });
  });

  it("mantém cadastro mesclado preservado", () => {
    expect(decideEmployeeRemoval({ status: "MERGED", mobileAccess: false, relatedRecords: 0 })).toEqual({
      mode: "PRESERVE_ONLY",
      hasHistoricalData: true,
      deactivatesMobileAccess: false,
    });
  });

  it("exige confirmação explícita; cancelar não gera uma solicitação válida", () => {
    expect(employeeRemovalConfirmationSchema.safeParse({ employeeId: "employee-1", confirmationName: "" }).success).toBe(false);
    expect(employeeRemovalConfirmationSchema.parse({ employeeId: "employee-1", confirmationName: "João Silva" })).toEqual({ employeeId: "employee-1", confirmationName: "João Silva" });
  });
});
