import { toBusinessDate } from "@/lib/dates/business";
import { isOperationalBusinessDate } from "@/modules/attendance/domain/operational-period";

interface TimestampedPunch {
  occurredAt: Date;
  fingerprint: string;
}

/**
 * Removes historical rows before they can reach links, persistence or
 * calculation. It also collapses repeated fingerprints inside the same file;
 * the database unique index remains the final cross-file guard.
 */
export function selectOperationalPunches<T extends TimestampedPunch>(punches: readonly T[]) {
  const selected: T[] = [];
  const fingerprints = new Set<string>();
  let ignoredBeforeOperation = 0;
  let duplicatedInFile = 0;

  for (const punch of punches) {
    if (!isOperationalBusinessDate(toBusinessDate(punch.occurredAt))) {
      ignoredBeforeOperation += 1;
      continue;
    }
    if (fingerprints.has(punch.fingerprint)) {
      duplicatedInFile += 1;
      continue;
    }
    fingerprints.add(punch.fingerprint);
    selected.push(punch);
  }

  return {
    punches: selected,
    ignoredBeforeOperation,
    duplicatedInFile,
    operationalRows: selected.length + duplicatedInFile,
  };
}

/** Parser errors with a recognizable historical date must not become RH work. */
export function isHistoricalImportError(error: { rawLine?: string | null }) {
  const match = error.rawLine?.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return Boolean(match && !isOperationalBusinessDate(match[1]!));
}
