export interface ImportedEmployeeDeviceLink {
  employeeId: string | null;
  externalEmployeeNumber: string;
}

/**
 * A device/EnNo link with no employee is intentionally retained after an
 * operational deletion. It is an audit-only identity, not a missing mapping
 * that the importer may turn into a new provisional employee.
 */
export function excludedExternalEmployeeNumbers(links: readonly ImportedEmployeeDeviceLink[]) {
  return new Set(links
    .filter((link) => link.employeeId === null)
    .map((link) => link.externalEmployeeNumber));
}

export function shouldCreateProvisionalEmployee(excludedNumbers: ReadonlySet<string>, externalEmployeeNumber: string) {
  return !excludedNumbers.has(externalEmployeeNumber);
}
