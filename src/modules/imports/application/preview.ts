import { createFileHash } from "@/modules/imports/domain/fingerprint";
import { parseAttendLog } from "@/modules/imports/domain/parser";

/** Pure server preview; intentionally independent from database and storage credentials. */
export function previewImport(content: Buffer) {
  return {
    fileHash: createFileHash(content),
    parsed: parseAttendLog(content),
  };
}
