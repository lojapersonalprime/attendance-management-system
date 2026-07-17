import { describe, expect, it } from "vitest";
import { createFileHash } from "@/modules/imports/domain/fingerprint";
import { parseAttendLog } from "@/modules/imports/domain/parser";
import { previewDeduplication } from "@/modules/imports/domain/deduplication";

const file = Buffer.from([
  "# DeviceUID = TEST-DEVICE-001",
  "# DataType = AttendLog",
  "# StartPos = 0, LogCount = 2, LimitPos = 100000",
  "No\tTMNo\tEnNo\tName\t\tGMNo\tMode\tIN/OUT\tAntipass\tDaiGong\tDateTime\tTR\t",
  "1\t1\t10\tPessoa\t\t1\t1\tS\t0\t0\t2026-06-10 08:00:00\tTime In\t",
  "2\t1\t10\tPessoa\t\t1\t1\tE\t0\t0\t2026-06-10 12:00:00\tTime Out\t",
].join("\n"));

describe("idempotência", () => {
  it("identifica o mesmo arquivo pelo SHA-256", () => {
    expect(createFileHash(file)).toBe(createFileHash(Buffer.from(file)));
  });

  it("arquivo repetido não possui registros novos", () => {
    const parsed = parseAttendLog(file);
    const preview = previewDeduplication(parsed.punches, new Set(parsed.punches.map((punch) => punch.fingerprint)));
    expect(preview.newPunches).toHaveLength(0);
    expect(preview.duplicatedPunches).toHaveLength(2);
  });

  it("arquivo cumulativo mantém somente nova marcação", () => {
    const parsed = parseAttendLog(file);
    const preview = previewDeduplication(parsed.punches, new Set([parsed.punches[0]?.fingerprint ?? ""]));
    expect(preview.newPunches).toHaveLength(1);
    expect(preview.duplicatedPunches).toHaveLength(1);
  });
});
