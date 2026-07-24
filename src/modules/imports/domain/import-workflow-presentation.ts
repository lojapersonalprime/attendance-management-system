export const importWorkflowSteps = ["Arquivo", "Análise", "Confirmação", "Importação", "Cálculo", "Resultado"] as const;

export type ImportWorkflowPhase = "idle" | "previewing" | "ready" | "importing" | "done" | "error";
export type ImportWorkflowStepState = "complete" | "current" | "waiting" | "error";

export function importWorkflowCurrentStep(phase: ImportWorkflowPhase) {
  if (phase === "previewing") return 1;
  if (phase === "ready") return 2;
  if (phase === "importing") return 3;
  if (phase === "done") return 5;
  return 0;
}

export function importWorkflowStepState(phase: ImportWorkflowPhase, index: number): ImportWorkflowStepState {
  const current = importWorkflowCurrentStep(phase);
  if (phase === "error" && index === current) return "error";
  if (phase === "done") return "complete";
  if (index < current) return "complete";
  if (index === current) return "current";
  return "waiting";
}

export function canConfirmImport(input: { newRows: number; duplicateFile: boolean }) {
  return input.newRows > 0 && !input.duplicateFile;
}

export function importResultPresentation(input: { duplicate: boolean; failedCalculationDays: number }) {
  if (input.duplicate) return { title: "Arquivo já processado", description: "Este arquivo já foi importado. Nenhuma marcação foi duplicada." };
  if (input.failedCalculationDays > 0) return { title: "Arquivo importado parcialmente", description: "Os registros foram salvos, mas alguns cálculos não foram concluídos." };
  return { title: "Arquivo processado com sucesso", description: "O arquivo foi processado e a apuração inicial foi atualizada." };
}
