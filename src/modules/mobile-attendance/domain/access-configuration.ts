export type MobileAccessActivationIssue =
  | "EMPLOYEE_NOT_ELIGIBLE"
  | "UNIT_MISMATCH"
  | "ACCOUNT_NOT_CONFIGURED"
  | "PIN_NOT_CONFIGURED"
  | "LOCATION_NOT_CONFIGURED";

export function mobileAccessActivationIssue(input: {
  employeeStatus: string;
  employeeProvisional: boolean;
  employeeUnitId: string | null;
  employeeUnitActive: boolean;
  accountActive: boolean;
  accountRole: string;
  pinConfigured: boolean;
  allowedUnitId: string;
  allowedUnitActive: boolean;
  authorizedLocation: { active: boolean; unitId: string } | null;
}): MobileAccessActivationIssue | null {
  if (input.employeeStatus !== "ACTIVE" || input.employeeProvisional || !input.employeeUnitId || !input.employeeUnitActive) return "EMPLOYEE_NOT_ELIGIBLE";
  if (!input.allowedUnitActive || input.employeeUnitId !== input.allowedUnitId) return "UNIT_MISMATCH";
  if (!input.accountActive || input.accountRole !== "EMPLOYEE") return "ACCOUNT_NOT_CONFIGURED";
  if (!input.pinConfigured) return "PIN_NOT_CONFIGURED";
  if (!input.authorizedLocation || !input.authorizedLocation.active || input.authorizedLocation.unitId !== input.allowedUnitId) return "LOCATION_NOT_CONFIGURED";
  return null;
}

export function mobileAccessActivationMessage(issue: MobileAccessActivationIssue) {
  const messages = {
    EMPLOYEE_NOT_ELIGIBLE: "Somente funcionário ativo e com cadastro completo pode usar o ponto pelo celular.",
    UNIT_MISMATCH: "A unidade autorizada não é compatível com o funcionário.",
    ACCOUNT_NOT_CONFIGURED: "Configure a conta de acesso do funcionário.",
    PIN_NOT_CONFIGURED: "Defina um PIN antes de ativar o acesso.",
    LOCATION_NOT_CONFIGURED: "Configure um local autorizado para esta unidade antes de ativar o acesso.",
  } satisfies Record<MobileAccessActivationIssue, string>;
  return messages[issue];
}
