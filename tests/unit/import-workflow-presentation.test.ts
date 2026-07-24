import { describe, expect, it } from "vitest";
import { canConfirmImport, importResultPresentation, importWorkflowCurrentStep, importWorkflowStepState, importWorkflowSteps } from "@/modules/imports/domain/import-workflow-presentation";

describe("apresentação do fluxo de importação", () => {
  it("mantém as seis etapas com destaque apenas para a etapa ativa", () => {
    expect(importWorkflowSteps).toEqual(["Arquivo", "Análise", "Confirmação", "Importação", "Cálculo", "Resultado"]);
    expect(importWorkflowCurrentStep("previewing")).toBe(1);
    expect(importWorkflowStepState("previewing", 0)).toBe("complete");
    expect(importWorkflowStepState("previewing", 1)).toBe("current");
    expect(importWorkflowStepState("previewing", 2)).toBe("waiting");
  });

  it("bloqueia confirmação sem marcações novas ou quando o arquivo já existe", () => {
    expect(canConfirmImport({ newRows: 0, duplicateFile: false })).toBe(false);
    expect(canConfirmImport({ newRows: 42, duplicateFile: true })).toBe(false);
    expect(canConfirmImport({ newRows: 42, duplicateFile: false })).toBe(true);
  });

  it("explica resultado parcial sem esconder que os registros foram salvos", () => {
    expect(importResultPresentation({ duplicate: false, failedCalculationDays: 2 })).toMatchObject({ title: "Arquivo importado parcialmente", description: "Os registros foram salvos, mas alguns cálculos não foram concluídos." });
    expect(importResultPresentation({ duplicate: true, failedCalculationDays: 0 }).title).toBe("Arquivo já processado");
  });
});
