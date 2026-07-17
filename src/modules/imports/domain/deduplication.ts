import type { ParsedPunch } from "@/modules/imports/domain/types";

export interface DeduplicationPreview {
  newPunches: ParsedPunch[];
  duplicatedPunches: ParsedPunch[];
}

/** Used for preview only; PostgreSQL unique indexes remain the final idempotency guard. */
export function previewDeduplication(
  punches: ParsedPunch[],
  knownFingerprints: ReadonlySet<string>,
): DeduplicationPreview {
  const seenInFile = new Set<string>();
  const newPunches: ParsedPunch[] = [];
  const duplicatedPunches: ParsedPunch[] = [];

  for (const punch of punches) {
    if (knownFingerprints.has(punch.fingerprint) || seenInFile.has(punch.fingerprint)) {
      duplicatedPunches.push(punch);
    } else {
      seenInFile.add(punch.fingerprint);
      newPunches.push(punch);
    }
  }

  return { newPunches, duplicatedPunches };
}
