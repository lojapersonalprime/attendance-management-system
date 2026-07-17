import { createHash } from "node:crypto";
import type { KnownPunchCode } from "@/modules/imports/domain/types";

export function createFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * A punch identity deliberately excludes source sequence and filename: both can change in
 * cumulative exports. Device-local seconds remain part of the identity.
 */
export function createPunchFingerprint(input: {
  deviceUid: string;
  externalEmployeeNumber: string;
  normalizedDateTime: string;
  punchCode: KnownPunchCode;
}): string {
  const canonical = [
    input.deviceUid.trim().toUpperCase(),
    input.externalEmployeeNumber.trim(),
    input.normalizedDateTime,
    input.punchCode,
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}
