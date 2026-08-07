export interface AttendanceIssuePresentation {
  title: string;
  description: string;
  group: "INCOMPLETE_DAY" | "CONTEXT" | "SCHEDULE" | "REVIEW" | "OTHER";
}

/**
 * Keeps calculation enums in the domain while giving RH one clear action per
 * situation. Technical type, codes and calculation metadata remain available
 * in the audit details, never as the primary wording.
 */
export function getAttendanceIssuePresentation(type: string): AttendanceIssuePresentation {
  switch (type) {
    case "ODD_PUNCH_COUNT":
    case "MISSING_EXIT":
    case "MISSING_BREAK_OUT":
    case "MISSING_BREAK_RETURN":
    case "MISSING_ENTRY":
    case "INCOMPLETE_DAY":
      return {
        title: "Falta uma batida para concluir o dia",
        description: "Há uma marcação de entrada, intervalo ou saída que não foi identificada. O período já comprovado continua registrado.",
        group: "INCOMPLETE_DAY",
      };
    case "INVALID_SEQUENCE":
      return { title: "Ordem das batidas precisa de revisão", description: "As batidas foram encontradas, mas não correspondem ao fluxo esperado para esta jornada.", group: "INCOMPLETE_DAY" };
    case "POSSIBLE_DUPLICATE":
      return { title: "Possível batida duplicada", description: "Duas batidas muito próximas foram encontradas. Confira antes de qualquer ajuste.", group: "REVIEW" };
    case "MULTIPLE_ENTRIES":
    case "MULTIPLE_EXITS":
    case "MOBILE_PUNCHES_EXCEED_EXPECTED":
      return { title: "Mais batidas do que o esperado", description: "O funcionário registrou o ponto mais vezes do que o previsto para esta jornada.", group: "REVIEW" };
    case "MOBILE_PUNCH_OUTSIDE_AUTHORIZED_AREA":
      return { title: "Registro realizado fora da área", description: "O registro pelo celular foi salvo para não perder o horário e precisa da análise do RH.", group: "REVIEW" };
    case "MOBILE_PUNCH_LOW_ACCURACY":
      return { title: "Localização com baixa precisão", description: "A precisão recebida não permitiu confirmar com segurança se a batida ocorreu na unidade.", group: "REVIEW" };
    case "ATTENDANCE_CORRECTION_REQUEST":
      return { title: "Solicitação de correção do funcionário", description: "O funcionário pediu uma análise. A solicitação não alterou nenhuma marcação original.", group: "REVIEW" };
    case "MISSING_SCHEDULE":
      return { title: "Modelo de horário não informado", description: "Defina o modelo de horário vigente para concluir o cálculo deste dia.", group: "CONTEXT" };
    case "MISSING_EMPLOYMENT_PERIOD":
      return { title: "Vínculo de trabalho não informado", description: "Defina o vínculo vigente para concluir o cálculo deste dia.", group: "CONTEXT" };
    case "MISSING_CALCULATION_POLICY":
      return { title: "Regra de cálculo não informada", description: "Defina a política vigente para concluir o cálculo deste dia.", group: "CONTEXT" };
    case "IMPORT_COVERAGE_UNCONFIRMED":
      return { title: "Cobertura do arquivo precisa de confirmação", description: "Confirme o período coberto pelo arquivo antes de calcular ausências ou saldos deste dia.", group: "CONTEXT" };
    case "EXCESS_TIME_PENDING":
      return { title: "Excedente aguardando aprovação", description: "O tempo excedente foi registrado, mas ainda precisa de uma decisão do RH.", group: "REVIEW" };
    case "LATE_ARRIVAL":
      return { title: "Atraso para revisar", description: "A entrada ocorreu depois do horário previsto pela jornada.", group: "REVIEW" };
    case "EARLY_DEPARTURE":
      return { title: "Saída antecipada para revisar", description: "A saída ocorreu antes do horário previsto pela jornada.", group: "REVIEW" };
    case "INTERVAL_TOO_SHORT":
      return { title: "Intervalo abaixo do previsto", description: "O intervalo registrado ficou abaixo da regra definida para esta jornada.", group: "REVIEW" };
    case "INTERVAL_TOO_LONG":
      return { title: "Intervalo acima do previsto", description: "O intervalo registrado ficou acima da regra definida para esta jornada.", group: "REVIEW" };
    case "PUNCH_OUTSIDE_SCHEDULE":
      return { title: "Horário fora da jornada prevista", description: "Uma batida ficou fora da faixa prevista e precisa de conferência.", group: "SCHEDULE" };
    case "PUNCH_ON_DAY_OFF":
      return { title: "Trabalho em dia de folga", description: "Há batidas em um dia sem jornada prevista. Confira o tratamento adequado.", group: "SCHEDULE" };
    case "PROVISIONAL_EMPLOYEE":
      return { title: "Cadastro do funcionário precisa de revisão", description: "Complete o cadastro para que o RH possa confirmar os dados vinculados ao relógio.", group: "CONTEXT" };
    default:
      return { title: "Registro precisa de revisão", description: "Este dia tem uma situação que precisa de uma decisão ou conferência do RH.", group: "OTHER" };
  }
}
