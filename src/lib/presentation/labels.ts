const auditActions: Record<string, string> = {
  ADJUSTMENT_CANCELLED: "Ajuste cancelado",
  ADJUSTMENT_CREATED: "Ajuste criado",
  BULK_EMPLOYEE_ACTION_COMPLETED: "Ação em lote concluída",
  BULK_EMPLOYEE_ACTION_REQUESTED: "Ação em lote solicitada",
  CALCULATION_PERIOD_CLOSED: "Competência fechada",
  CALCULATION_PERIOD_REOPENED: "Competência reaberta",
  CALCULATION_POLICY_DEFAULTS_ENSURED: "Políticas iniciais disponibilizadas",
  CALCULATION_RUN_COMPLETED: "Recálculo concluído",
  CALCULATION_RUN_STARTED: "Recálculo iniciado",
  CLOSED_PERIOD_CHANGE_ATTEMPT: "Alteração em competência fechada bloqueada",
  EMPLOYEE_CREATED: "Funcionário criado",
  EMPLOYEE_DEPARTMENT_CHANGED: "Setor do funcionário alterado",
  EMPLOYEE_DEVICE_LINK_CREATED: "Vínculo com relógio criado",
  EMPLOYEE_DEVICE_LINK_ENDED: "Vínculo com relógio encerrado",
  EMPLOYEE_EMPLOYMENT_TYPE_CHANGED: "Tipo de vínculo do funcionário alterado",
  EMPLOYEE_MERGED: "Cadastros de funcionários mesclados",
  EMPLOYEE_POSITION_CHANGED: "Cargo do funcionário alterado",
  EMPLOYEE_PROVISIONAL_COMPLETED: "Cadastro provisório concluído",
  EMPLOYEE_SCHEDULE_ASSIGNED: "Jornada atribuída ao funcionário",
  EMPLOYEE_STATUS_CHANGED: "Status do funcionário alterado",
  EMPLOYEE_TAG_ASSIGNED: "Etiqueta atribuída ao funcionário",
  EMPLOYEE_TAG_REMOVED: "Etiqueta removida do funcionário",
  EMPLOYEE_UNIT_CHANGED: "Unidade do funcionário alterada",
  EMPLOYEE_MOBILE_ACCESS_PROVISIONED: "Acesso mobile do funcionário habilitado",
  EMPLOYEE_MOBILE_ACCESS_UPDATED: "Acesso mobile do funcionário atualizado",
  EMPLOYEE_UPDATED: "Cadastro do funcionário atualizado",
  EMPLOYMENT_PERIOD_CREATED: "Período de vínculo criado",
  IMPORT_COMPLETED: "Importação concluída",
  IMPORT_COVERAGE_CONFIRMED: "Cobertura do arquivo confirmada",
  IMPORT_FAILED: "Importação com falha",
  MOBILE_PUNCH_REGISTERED: "Ponto registrado pelo celular",
  MOBILE_PUNCH_PIN_FAILED: "Tentativa de PIN inválida",
  MOBILE_PUNCH_PIN_ATTEMPT_LOCKED: "Tentativa de PIN durante bloqueio",
  MOBILE_PUNCH_LOCATION_BLOCKED: "Registro mobile bloqueado por localização",
  MOBILE_PUNCH_LOCATION_REVIEWED: "Localização mobile revisada",
  INCONSISTENCY_STATUS_UPDATED: "Status da inconsistência atualizado",
  RECALCULATION_COMPLETED: "Recálculo concluído",
  RECALCULATION_FAILED: "Recálculo com falha",
  RECALCULATION_REQUESTED: "Recálculo solicitado",
  SCHEDULE_TEMPLATE_CREATED: "Jornada criada",
  SCHEDULE_TEMPLATE_DUPLICATED: "Jornada duplicada",
  SCHEDULE_TEMPLATE_UPDATED: "Jornada atualizada",
  SCHEDULE_TEMPLATE_VERSION_CREATED: "Nova versão da jornada criada",
};

const entities: Record<string, string> = {
  Adjustment: "Ajuste",
  CalculationPolicy: "Política de cálculo",
  CalculationRun: "Processamento de cálculo",
  ClosingPeriod: "Fechamento mensal",
  Department: "Setor",
  Employee: "Funcionário",
  EmployeeBulkAction: "Ação em lote de funcionários",
  EmployeeDeviceLink: "Vínculo com relógio",
  EmployeeEmploymentPeriod: "Período de vínculo",
  EmployeeMobileAccess: "Acesso mobile do funcionário",
  EmployeeScheduleAssignment: "Atribuição de jornada",
  EmployeeTag: "Etiqueta de funcionário",
  EmployeeTagAssignment: "Etiqueta de funcionário",
  ImportFile: "Arquivo importado",
  Inconsistency: "Inconsistência",
  Position: "Cargo",
  ScheduleTemplate: "Jornada",
  Unit: "Unidade",
  AuthorizedLocation: "Local autorizado",
  MobilePunch: "Registro pelo celular",
  AttendanceCorrectionRequest: "Solicitação de correção",
};

const employmentTypes: Record<string, string> = {
  EMPLOYEE: "Funcionário",
  INTERN: "Estagiário",
  APPRENTICE: "Jovem aprendiz",
  CONTRACTOR: "Prestador de serviço",
  OTHER: "Outro",
};

const employeeStatuses: Record<string, string> = {
  PENDING: "Cadastro pendente",
  ACTIVE: "Ativo",
  ON_LEAVE: "Afastado",
  VACATION: "Férias",
  INACTIVE: "Inativo",
  TERMINATED: "Desligado",
  MERGED: "Mesclado",
};

const inconsistencyTypes: Record<string, string> = {
  UNKNOWN_EMPLOYEE: "Funcionário não identificado",
  PROVISIONAL_EMPLOYEE: "Funcionário provisório",
  MISSING_EMPLOYMENT_PERIOD: "Vínculo não informado",
  OVERLAPPING_EMPLOYMENT_PERIOD: "Vínculos sobrepostos",
  MISSING_CALCULATION_POLICY: "Política de cálculo não informada",
  MISSING_SCHEDULE: "Jornada não informada",
  OVERLAPPING_SCHEDULE: "Jornadas sobrepostas",
  IMPORT_COVERAGE_UNCONFIRMED: "Cobertura do arquivo não confirmada",
  NO_PUNCHES_ON_SCHEDULED_DAY: "Sem marcações no dia previsto",
  ODD_PUNCH_COUNT: "Quantidade ímpar de marcações",
  MISSING_ENTRY: "Entrada não identificada",
  MISSING_EXIT: "Saída não identificada",
  MISSING_BREAK_OUT: "Saída para intervalo não identificada",
  MISSING_BREAK_RETURN: "Retorno do intervalo não identificado",
  INVALID_SEQUENCE: "Sequência de marcações inválida",
  POSSIBLE_DUPLICATE: "Possível marcação duplicada",
  MULTIPLE_ENTRIES: "Múltiplas entradas",
  MULTIPLE_EXITS: "Múltiplas saídas",
  PUNCH_ON_DAY_OFF: "Marcação em dia de folga",
  PUNCH_OUTSIDE_SCHEDULE: "Marcação fora da jornada",
  LATE_ARRIVAL: "Atraso",
  EARLY_DEPARTURE: "Saída antecipada",
  INTERVAL_TOO_SHORT: "Intervalo abaixo do previsto",
  INTERVAL_TOO_LONG: "Intervalo acima do previsto",
  EXCESS_TIME_PENDING: "Excedente aguardando aprovação",
  INCOMPLETE_DAY: "Dia incompleto",
  ADJUSTMENT_REQUIRED: "Ajuste necessário",
  CLOSED_PERIOD_CHANGE_ATTEMPT: "Alteração bloqueada em competência fechada",
  CALCULATION_FAILED: "Falha no cálculo",
  INVALID_DATETIME: "Data ou hora inválida",
  INVALID_ROW: "Linha inválida no arquivo",
  UNKNOWN_PUNCH_CODE: "Código de marcação desconhecido",
  IMPORT_COUNT_MISMATCH: "Quantidade de marcações divergente",
  MOBILE_PUNCH_OUTSIDE_AUTHORIZED_AREA: "Registro fora da área autorizada",
  MOBILE_PUNCH_LOW_ACCURACY: "Localização com baixa precisão",
  MOBILE_PUNCHES_EXCEED_EXPECTED: "Mais registros mobile do que o esperado",
  ATTENDANCE_CORRECTION_REQUEST: "Solicitação de correção do funcionário",
};

export function getAuditActionLabel(value: string) { return auditActions[value] ?? "Ação administrativa"; }
export function getEntityTypeLabel(value: string) { return entities[value] ?? "Item administrativo"; }
export function getEmploymentTypeLabel(value: string) { return employmentTypes[value] ?? "Não informado"; }
export function getEmployeeStatusLabel(value: string) { return employeeStatuses[value] ?? "Não informado"; }
export function getInconsistencyTypeLabel(value: string) { return inconsistencyTypes[value] ?? "Inconsistência"; }
export function getInconsistencyStatusLabel(value: string) { return ({ OPEN: "Aberta", IN_REVIEW: "Em análise", RESOLVED: "Resolvida", DISMISSED: "Dispensada", AUTO_RESOLVED: "Resolvida automaticamente", REOPENED: "Reaberta" } as Record<string, string>)[value] ?? "Não informado"; }
export function getSeverityLabel(value: string) { return ({ INFO: "Informação", WARNING: "Atenção", CRITICAL: "Crítica" } as Record<string, string>)[value] ?? "Não informado"; }
export function getCalculationRunStatusLabel(value: string) { return ({ PENDING: "Aguardando", PROCESSING: "Em processamento", COMPLETED: "Concluído", PARTIAL: "Concluído com pendências", FAILED: "Falhou" } as Record<string, string>)[value] ?? "Não informado"; }
export function getDailySummaryStatusLabel(value: string) { return ({ PROVISIONAL: "Preliminar", NEEDS_REVIEW: "Requer revisão", REGULAR: "Regular", CLOSED: "Fechada" } as Record<string, string>)[value] ?? "Não informado"; }
export function getAdjustmentTypeLabel(value: string) { return ({ MISSING_PUNCH: "Marcação ausente", DUPLICATE_PUNCH: "Possível duplicidade", INVALID_PUNCH: "Marcação inválida", MEDICAL_CERTIFICATE: "Atestado", JUSTIFIED_ABSENCE: "Ausência justificada", UNJUSTIFIED_ABSENCE: "Ausência não justificada", EXTERNAL_WORK: "Trabalho externo", DAY_OFF: "Folga", VACATION: "Férias", LEAVE: "Afastamento", HOURS_CREDIT: "Crédito de horas", HOURS_DEBIT: "Débito de horas", EXCESS_APPROVAL: "Aprovação de excedente", SCHEDULE_CORRECTION: "Correção de jornada" } as Record<string, string>)[value] ?? "Ajuste"; }
export function getAdjustmentStatusLabel(value: string) { return value === "ACTIVE" ? "Ativo" : value === "CANCELLED" ? "Cancelado" : "Não informado"; }
export function getEmploymentPeriodStatusLabel(value: string) { return ({ ACTIVE: "Vigente", ENDED: "Encerrado", CANCELLED: "Cancelado" } as Record<string, string>)[value] ?? "Não informado"; }
export function getToleranceModeLabel(value: string) { return ({ EXCESS_ONLY: "Aplicar apenas ao excedente", FULL_EVENT: "Aplicar ao evento inteiro", IGNORE_WITHIN_TOLERANCE: "Ignorar dentro da tolerância" } as Record<string, string>)[value] ?? "Não informado"; }
export function getEntryToleranceModeLabel(value: string) { return ({ FULL_DELAY_AFTER_TOLERANCE: "Após a tolerância, contar todo o atraso", EXCESS_ONLY_AFTER_TOLERANCE: "Após a tolerância, contar somente o excedente" } as Record<string, string>)[value] ?? "Não informado"; }
export function getScheduleFormErrorMessage(code: string | undefined) {
  return ({
    "jornada-invalida": "Revise os horários e os dias trabalhados da jornada.",
    "historico-preservado": "Esta jornada possui histórico. Crie uma nova versão para preservar o passado.",
    "motivo-obrigatorio": "Informe o motivo para concluir esta ação.",
    "jornada-indisponivel": "Não foi possível salvar a jornada. Tente novamente.",
  } as Record<string, string>)[code ?? ""] ?? undefined;
}
