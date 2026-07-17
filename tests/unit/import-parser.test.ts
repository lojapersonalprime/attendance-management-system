import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createPunchFingerprint } from "@/modules/imports/domain/fingerprint";
import { parseAttendLog } from "@/modules/imports/domain/parser";

const header = "No\tTMNo\tEnNo\tName\t\tGMNo\tMode\tIN/OUT\tAntipass\tDaiGong\tDateTime\tTR\t";

function line(code: string, dateTime: string, employeeNumber = "10") {
  return `1\t1\t${employeeNumber}\tPessoa Sintética\t\t1\t1\t${code}\t0\t0\t${dateTime}\tDescrição\t`;
}

function attendLog(rows: string[], metadata = "# StartPos = 0, LogCount = 4, LimitPos = 100000") {
  return [
    "# DeviceModel = S362E Excel",
    "# DeviceUID = TEST-DEVICE-001",
    "# DataType = AttendLog",
    metadata,
    header,
    ...rows,
  ].join("\r\n");
}

describe("AttendLog parser", () => {
  it("lê o fixture público UTF-16 LE, remove BOM e interpreta metadados", () => {
    const result = parseAttendLog(readFileSync("tests/fixtures/attendlog-synthetic.txt"));
    expect(result.encoding).toBe("utf-16le");
    expect(result.metadata.deviceUid).toBe("SYNTHETIC-DEVICE-001");
    expect(result.metadata.declaredLogCount).toBe(9);
    expect(result.headers).toContain("IN/OUT");
    expect(result.punches).toHaveLength(9);
  });

  it("mantém colunas vazias e aceita espaços duplicados entre data e hora", () => {
    const result = parseAttendLog(Buffer.from(attendLog([line("S", "2026-06-10  08:00:20")])));
    expect(result.punches[0]?.gmNumber).toBe("1");
    expect(result.punches[0]?.originalDateTime).toBe("2026-06-10  08:00:20");
    expect(result.punches[0]?.normalizedDateTime).toBe("2026-06-10T08:00:20");
  });

  it.each([
    ["S", "Entrada inicial"],
    ["E", "Saída para intervalo"],
    ["A", "Retorno do intervalo"],
    ["F", "Saída final"],
  ])("interpreta código %s", (code, description) => {
    const result = parseAttendLog(Buffer.from(attendLog([line(code, "2026-06-10 08:00:20")])))
    expect(result.punches[0]?.punchDescription).toBe(description);
  });

  it("rejeita código desconhecido, data inválida e linha incompleta", () => {
    const result = parseAttendLog(Buffer.from(attendLog([
      line("X", "2026-06-10 08:00:20"),
      line("S", "2026-02-31 08:00:20"),
      "1\t1\t\tPessoa\t\t1\t1\tS\t0\t0\t\tDescrição\t",
    ])));
    expect(result.errors.map((error) => error.errorCode)).toEqual(expect.arrayContaining([
      "UNKNOWN_PUNCH_CODE",
      "INVALID_DATETIME",
      "INVALID_ROW",
    ]));
  });

  it("registra divergência entre LogCount e linhas encontradas", () => {
    const result = parseAttendLog(Buffer.from(attendLog([line("S", "2026-06-10 08:00:20")], "# StartPos = 0, LogCount = 99, LimitPos = 100000")));
    expect(result.errors.some((error) => error.errorCode === "IMPORT_COUNT_MISMATCH")).toBe(true);
  });

  it("rejeita DataType diferente de AttendLog", () => {
    const result = parseAttendLog(Buffer.from(attendLog([line("S", "2026-06-10 08:00:20")]).replace("AttendLog", "Other")));
    expect(result.errors.some((error) => error.errorCode === "INVALID_DATA_TYPE")).toBe(true);
  });

  it("gera fingerprint determinístico", () => {
    const input = { deviceUid: "TEST-DEVICE-001", externalEmployeeNumber: "10", normalizedDateTime: "2026-06-10T08:00:20", punchCode: "S" as const };
    expect(createPunchFingerprint(input)).toBe(createPunchFingerprint(input));
    expect(createPunchFingerprint(input)).not.toBe(createPunchFingerprint({ ...input, punchCode: "E" }));
  });
});
