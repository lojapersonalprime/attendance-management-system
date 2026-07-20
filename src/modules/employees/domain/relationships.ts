export interface ValidityWindow<T extends string = string> {
  id: T;
  validFrom: string;
  validUntil?: string | null;
  active?: boolean;
}

export function windowsOverlap<T extends string>(left: ValidityWindow<T>, right: ValidityWindow<T>): boolean {
  if (left.active === false || right.active === false) return false;
  const leftEnd = left.validUntil ?? "9999-12-31";
  const rightEnd = right.validUntil ?? "9999-12-31";
  return left.validFrom <= rightEnd && right.validFrom <= leftEnd;
}

export function hasOverlappingDeviceLink<T extends string>(
  links: readonly ValidityWindow<T>[],
  candidate: ValidityWindow<T>,
): boolean {
  return links.some((link) => link.id !== candidate.id && windowsOverlap(link, candidate));
}

export interface MergeEmployeeSnapshot {
  id: string;
  registration?: string | null;
  cpf?: string | null;
  scheduleAssignments: readonly ValidityWindow[];
  deviceLinks: ReadonlyArray<ValidityWindow & { deviceId: string; externalEmployeeNumber: string }>;
  dailySummaryDates: readonly string[];
  tagIds: readonly string[];
}

export interface MergeConflict {
  code: "REGISTRATION_MISMATCH" | "CPF_MISMATCH" | "SCHEDULE_OVERLAP" | "DEVICE_LINK_OVERLAP" | "DAILY_SUMMARY_DUPLICATE" | "DUPLICATE_TAG";
  blocking: boolean;
  message: string;
}

export function findMergeConflicts(primary: MergeEmployeeSnapshot, secondary: MergeEmployeeSnapshot): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  if (primary.registration && secondary.registration && primary.registration !== secondary.registration) {
    conflicts.push({ code: "REGISTRATION_MISMATCH", blocking: true, message: "Os cadastros possuem matrículas diferentes." });
  }
  if (primary.cpf && secondary.cpf && primary.cpf !== secondary.cpf) {
    conflicts.push({ code: "CPF_MISMATCH", blocking: true, message: "Os cadastros possuem CPF diferente." });
  }
  if (primary.scheduleAssignments.some((left) => secondary.scheduleAssignments.some((right) => windowsOverlap(left, right)))) {
    conflicts.push({ code: "SCHEDULE_OVERLAP", blocking: true, message: "As jornadas possuem vigências sobrepostas." });
  }
  if (primary.deviceLinks.some((left) => secondary.deviceLinks.some((right) => (
    left.deviceId === right.deviceId
    && left.externalEmployeeNumber === right.externalEmployeeNumber
    && windowsOverlap(left, right)
  )))) {
    conflicts.push({ code: "DEVICE_LINK_OVERLAP", blocking: true, message: "Há vínculos ativos do mesmo EnNo e dispositivo em período sobreposto." });
  }
  if (secondary.dailySummaryDates.some((date) => primary.dailySummaryDates.includes(date))) {
    conflicts.push({ code: "DAILY_SUMMARY_DUPLICATE", blocking: true, message: "Há apurações diárias para a mesma data nos dois cadastros." });
  }
  if (secondary.tagIds.some((tagId) => primary.tagIds.includes(tagId))) {
    conflicts.push({ code: "DUPLICATE_TAG", blocking: false, message: "Tags repetidas serão preservadas apenas no cadastro principal." });
  }
  return conflicts;
}
