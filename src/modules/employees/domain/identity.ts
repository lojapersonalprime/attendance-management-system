export interface EmployeeIdentity {
  id: string;
  registration?: string | null;
  cpf?: string | null;
}

export type EmployeeIdentityConflict = "REGISTRATION" | "CPF";

export function findEmployeeIdentityConflicts(
  candidate: Pick<EmployeeIdentity, "registration" | "cpf">,
  employees: readonly EmployeeIdentity[],
  excludedEmployeeId?: string,
): EmployeeIdentityConflict[] {
  const scoped = employees.filter((employee) => employee.id !== excludedEmployeeId);
  const conflicts: EmployeeIdentityConflict[] = [];
  if (candidate.registration && scoped.some((employee) => employee.registration === candidate.registration)) conflicts.push("REGISTRATION");
  if (candidate.cpf && scoped.some((employee) => employee.cpf === candidate.cpf)) conflicts.push("CPF");
  return conflicts;
}
