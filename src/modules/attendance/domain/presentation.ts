export type ImportedPunchCode = "S" | "E" | "A" | "F";

export interface ImportedPunchPresentation {
  occurredAt: Date;
  punchCode: ImportedPunchCode;
}

export const punchPresentation = {
  S: { label: "Entrada", state: "Jornada iniciada" },
  E: { label: "Saída para almoço", state: "Em intervalo" },
  A: { label: "Retorno do almoço", state: "Jornada em andamento" },
  F: { label: "Saída final", state: "Jornada encerrada" },
} as const;

export function getLastImportedAttendanceState(punches: readonly ImportedPunchPresentation[]) {
  const last = [...punches].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
  if (!last) return { label: "Sem registro no período", description: "Nenhuma marcação foi encontrada no arquivo importado.", punch: null };
  const presentation = punchPresentation[last.punchCode];
  return { label: presentation.state, description: presentation.label, punch: last };
}

export function getDayAttendanceState(punches: readonly ImportedPunchPresentation[], incomplete: boolean) {
  if (incomplete) return { label: "Marcação incompleta", description: "Há uma saída ou retorno que precisa de revisão." };
  return getLastImportedAttendanceState(punches);
}
