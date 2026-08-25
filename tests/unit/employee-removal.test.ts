import { describe, expect, it } from "vitest";
import { decideEmployeeRemoval, employeeRemovalConfirmationSchema } from "@/modules/employees/domain/removal";

describe("remoção segura de funcionário", () => {
  it.each(["ACTIVE", "INACTIVE", "TERMINATED", "PENDING"])("permite exclusão operacional para cadastro %s, mesmo com dados derivados", (status) => {
    expect(decideEmployeeRemoval({ status })).toEqual({
      mode: "DELETE",
    });
  });

  it("mantém cadastro mesclado preservado", () => {
    expect(decideEmployeeRemoval({ status: "MERGED" })).toEqual({
      mode: "PRESERVE_ONLY",
    });
  });

  it("mantém a referência de mesclagem preservada", () => {
    expect(decideEmployeeRemoval({ status: "ACTIVE", hasMergedEmployees: true })).toEqual({
      mode: "PRESERVE_ONLY",
    });
  });

  it("exige confirmação explícita; cancelar não gera uma solicitação válida", () => {
    expect(employeeRemovalConfirmationSchema.safeParse({ employeeId: "employee-1", confirmationName: "" }).success).toBe(false);
    expect(employeeRemovalConfirmationSchema.parse({ employeeId: "employee-1", confirmationName: "João Silva" })).toEqual({ employeeId: "employee-1", confirmationName: "João Silva" });
  });
});
