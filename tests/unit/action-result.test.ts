import { describe, expect, it } from "vitest";
import { actionErrorCode, actionErrorMessage, type ActionResult } from "@/lib/forms/action-result";

describe("mensagens de ações do RH", () => {
  it("mantém a estrutura de retorno e converte falha de validação em mensagem humana", () => {
    const result: ActionResult = { success: false, fieldErrors: { validFrom: ["Informe a data de início."] }, formError: "Revise os campos informados." };
    expect(result.success).toBe(false);
    expect(actionErrorCode({ issues: [{ path: ["validFrom"] }] })).toBe("validacao");
    expect(actionErrorMessage("validacao")).toBe("Revise os campos informados antes de continuar.");
  });

  it("não devolve a mensagem técnica original para a URL", () => {
    expect(actionErrorCode(new Error("reason invalid_type"))).toBe("motivo");
    expect(actionErrorMessage(actionErrorCode(new Error("validFrom invalid_type")))).toBe("Informe a data de início.");
  });

  it("explica confirmação retroativa e conflito de vigência sem expor exceção", () => {
    expect(actionErrorCode(new Error("Confirme a atribuição retroativa antes de aplicá-la."))).toBe("retroativa");
    expect(actionErrorMessage("retroativa")).toContain("começa no passado");
    expect(actionErrorCode(new Error("Já existe jornada com vigência sobreposta."))).toBe("sobreposicao");
    expect(actionErrorMessage("sobreposicao")).toContain("Já existe uma jornada");
  });
});
