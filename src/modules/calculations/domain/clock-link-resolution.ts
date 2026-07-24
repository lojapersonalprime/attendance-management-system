export interface ClockLinkIdentity {
  id: string;
  employeeId: string;
  deviceId: string;
  externalEmployeeNumber: string;
  validFrom: string;
  validUntil: string | null;
}

export interface PunchIdentity {
  deviceId: string;
  externalEmployeeNumber: string;
  employeeDeviceLinkId: string | null;
  businessDate: string;
}

function appliesOn(link: ClockLinkIdentity, businessDate: string) {
  return link.validFrom <= businessDate && (!link.validUntil || link.validUntil >= businessDate);
}

/**
 * New imports keep employeeDeviceLinkId. Older immutable RawPunch rows can be
 * resolved safely through the device, clock code and link validity instead.
 */
export function resolvePunchEmployeeId(punch: PunchIdentity, links: readonly ClockLinkIdentity[]) {
  const matching = links
    .filter((link) => (punch.employeeDeviceLinkId === link.id || (link.deviceId === punch.deviceId && link.externalEmployeeNumber === punch.externalEmployeeNumber)) && appliesOn(link, punch.businessDate))
    .sort((left, right) => right.validFrom.localeCompare(left.validFrom));
  return matching[0]?.employeeId;
}
