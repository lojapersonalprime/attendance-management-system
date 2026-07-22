export interface ActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  formError?: string;
}

export type ActionErrorCode = "validacao" | "data-inicial" | "motivo" | "jornada" | "indisponivel";

export function actionErrorCode(error: unknown): ActionErrorCode {
  if (error && typeof error === "object" && "issues" in error) return "validacao";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("validfrom") || message.includes("data de início") || message.includes("início")) return "data-inicial";
  if (message.includes("motivo") || message.includes("reason")) return "motivo";
  if (message.includes("jornada") || message.includes("schedule")) return "jornada";
  return "indisponivel";
}

export function actionErrorMessage(code: string | undefined) {
  return ({
    validacao: "Revise os campos informados antes de continuar.",
    "data-inicial": "Informe a data de início.",
    motivo: "Informe o motivo da alteração.",
    jornada: "Selecione uma jornada válida.",
    indisponivel: "Não foi possível concluir esta ação. Tente novamente.",
  } as Record<ActionErrorCode, string>)[code as ActionErrorCode] ?? undefined;
}
