export interface ActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  formError?: string;
}

export type ActionErrorCode = "validacao" | "data-inicial" | "data-final" | "motivo" | "jornada" | "retroativa" | "sobreposicao" | "competencia-fechada" | "indisponivel";

export function actionErrorCode(error: unknown): ActionErrorCode {
  if (error && typeof error === "object" && "issues" in error) return "validacao";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("retroativa")) return "retroativa";
  if (message.includes("sobrepost") || message.includes("conflita")) return "sobreposicao";
  if (message.includes("competência está fechada") || message.includes("competencia está fechada")) return "competencia-fechada";
  if (message.includes("data final") || message.includes("data limite")) return "data-final";
  if (message.includes("validfrom") || message.includes("data de início") || message.includes("início")) return "data-inicial";
  if (message.includes("motivo") || message.includes("reason")) return "motivo";
  if (message.includes("jornada") || message.includes("schedule")) return "jornada";
  return "indisponivel";
}

export function actionErrorMessage(code: string | undefined) {
  return ({
    validacao: "Revise os campos informados antes de continuar.",
    "data-inicial": "Informe a data de início.",
    "data-final": "Informe uma data final válida e posterior à data de início.",
    motivo: "Informe o motivo da alteração.",
    jornada: "Selecione uma jornada válida.",
    retroativa: "Esta jornada começa no passado. Marque a confirmação de aplicação retroativa para continuar.",
    sobreposicao: "Já existe uma jornada atribuída nesse período. Encerre a anterior ou escolha outra vigência.",
    "competencia-fechada": "A competência está fechada. Reabra-a antes de recalcular esse período.",
    indisponivel: "Não foi possível concluir esta ação. Tente novamente.",
  } as Record<ActionErrorCode, string>)[code as ActionErrorCode] ?? undefined;
}
