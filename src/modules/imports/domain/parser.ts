import { z } from "zod";
import { businessDateTimeToUtc } from "@/lib/dates/business";
import { createPunchFingerprint } from "@/modules/imports/domain/fingerprint";
import {
  KNOWN_PUNCH_CODES,
  PUNCH_DESCRIPTIONS,
  type KnownPunchCode,
  type ParsedAttendanceImport,
  type ParsedImportError,
  type ParsedImportMetadata,
  type ParsedPunch,
} from "@/modules/imports/domain/types";

const requiredRowSchema = z.object({
  externalEmployeeNumber: z.string().trim().min(1),
  punchCode: z.string().trim().min(1),
  originalDateTime: z.string().trim().min(1),
});

type FileEncoding = ParsedAttendanceImport["encoding"];

interface DecodedFile {
  encoding: FileEncoding;
  content: string;
}

const headerNames = [
  "No",
  "TMNo",
  "EnNo",
  "Name",
  "GMNo",
  "Mode",
  "IN/OUT",
  "Antipass",
  "DaiGong",
  "DateTime",
  "TR",
] as const;

export function detectAndDecodeAttendanceFile(buffer: Buffer): DecodedFile {
  const hasUtf16LeBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const hasUtf16BeBom = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;

  if (hasUtf16LeBom) {
    return { encoding: "utf-16le", content: new TextDecoder("utf-16le").decode(buffer) };
  }

  if (hasUtf16BeBom) {
    return { encoding: "utf-16be", content: new TextDecoder("utf-16be").decode(buffer) };
  }

  return { encoding: "utf-8", content: new TextDecoder("utf-8").decode(buffer) };
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\uFEFF/, "");
}

function isKnownPunchCode(value: string): value is KnownPunchCode {
  return (KNOWN_PUNCH_CODES as readonly string[]).includes(value);
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseMetadataLine(line: string, metadata: ParsedImportMetadata): void {
  const pair = line.replace(/^\uFEFF/, "").match(/^#\s*([^=]+?)\s*=\s*(.*)$/);
  if (!pair?.[1] || pair[2] === undefined) return;

  const key = pair[1].trim();
  const value = pair[2].trim();
  metadata.values[key] = value;

  if (key === "DeviceModel") metadata.deviceModel = value;
  if (key === "DeviceUID") metadata.deviceUid = value;
  if (key === "DataType") metadata.dataType = value;

  if (key === "StartPos") {
    const positions = value.match(
      /^(?<start>\d+)\s*,\s*LogCount\s*=\s*(?<count>\d+)\s*,\s*LimitPos\s*=\s*(?<limit>\d+)$/i,
    );
    if (positions?.groups) {
      metadata.startPosition = parseOptionalInteger(positions.groups.start);
      metadata.declaredLogCount = parseOptionalInteger(positions.groups.count);
      metadata.limitPosition = parseOptionalInteger(positions.groups.limit);
    }
  }
}

function parseDeviceDateTime(value: string):
  | { occurredAt: Date; normalizedDateTime: string }
  | undefined {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;

  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day ||
    calendarCheck.getUTCHours() !== hour ||
    calendarCheck.getUTCMinutes() !== minute ||
    calendarCheck.getUTCSeconds() !== second
  ) {
    return undefined;
  }

  const normalizedDateTime = `${rawYear}-${rawMonth}-${rawDay}T${rawHour}:${rawMinute}:${rawSecond}`;
  return {
    normalizedDateTime,
    occurredAt: businessDateTimeToUtc(normalizedDateTime),
  };
}

function createHeaderIndex(headers: string[]): Map<string, number> {
  const indexes = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized && !indexes.has(normalized)) indexes.set(normalized, index);
  });
  return indexes;
}

function getColumn(columns: string[], headers: Map<string, number>, name: string): string {
  const index = headers.get(name);
  return index === undefined ? "" : (columns[index] ?? "");
}

function rowError(
  rowNumber: number,
  rawLine: string,
  errorCode: ParsedImportError["errorCode"],
  message: string,
): ParsedImportError {
  return { rowNumber, rawLine, errorCode, message };
}

function parsePunchRow(input: {
  rowNumber: number;
  rawLine: string;
  columns: string[];
  headers: Map<string, number>;
  deviceUid: string;
}): ParsedPunch | ParsedImportError {
  const originalDateTime = getColumn(input.columns, input.headers, "DateTime");
  const externalEmployeeNumber = getColumn(input.columns, input.headers, "EnNo");
  const punchCodeRaw = getColumn(input.columns, input.headers, "IN/OUT").trim().toUpperCase();
  const validation = requiredRowSchema.safeParse({
    externalEmployeeNumber,
    punchCode: punchCodeRaw,
    originalDateTime,
  });

  if (!validation.success) {
    return rowError(input.rowNumber, input.rawLine, "INVALID_ROW", "Linha incompleta: EnNo, IN/OUT e DateTime são obrigatórios.");
  }

  if (!isKnownPunchCode(punchCodeRaw)) {
    return rowError(input.rowNumber, input.rawLine, "UNKNOWN_PUNCH_CODE", `Código IN/OUT desconhecido: ${punchCodeRaw}.`);
  }

  const dateTime = parseDeviceDateTime(originalDateTime);
  if (!dateTime) {
    return rowError(input.rowNumber, input.rawLine, "INVALID_DATETIME", "DateTime inválido; esperado AAAA-MM-DD HH:mm:ss.");
  }

  return {
    sourceRowNumber: input.rowNumber,
    sourceSequence: parseOptionalInteger(getColumn(input.columns, input.headers, "No")),
    tmNumber: getColumn(input.columns, input.headers, "TMNo").trim() || undefined,
    externalEmployeeNumber: externalEmployeeNumber.trim(),
    employeeNameRaw: getColumn(input.columns, input.headers, "Name").trim() || undefined,
    gmNumber: getColumn(input.columns, input.headers, "GMNo").trim() || undefined,
    mode: getColumn(input.columns, input.headers, "Mode").trim() || undefined,
    punchCode: punchCodeRaw,
    punchDescription: PUNCH_DESCRIPTIONS[punchCodeRaw],
    antipass: getColumn(input.columns, input.headers, "Antipass").trim() || undefined,
    daiGong: getColumn(input.columns, input.headers, "DaiGong").trim() || undefined,
    occurredAt: dateTime.occurredAt,
    normalizedDateTime: dateTime.normalizedDateTime,
    originalDateTime,
    rawLine: input.rawLine,
    fingerprint: createPunchFingerprint({
      deviceUid: input.deviceUid,
      externalEmployeeNumber: externalEmployeeNumber.trim(),
      normalizedDateTime: dateTime.normalizedDateTime,
      punchCode: punchCodeRaw,
    }),
  };
}

export function parseAttendLog(buffer: Buffer): ParsedAttendanceImport {
  const decoded = detectAndDecodeAttendanceFile(buffer);
  const lines = decoded.content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata: ParsedImportMetadata = { values: {} };
  const errors: ParsedImportError[] = [];
  const punches: ParsedPunch[] = [];
  let headers: string[] = [];
  let headerIndex: Map<string, number> | undefined;
  let totalDataRows = 0;

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    const normalizedLine = line.replace(/^\uFEFF/, "");
    if (!normalizedLine.trim()) return;

    if (normalizedLine.trimStart().startsWith("#")) {
      parseMetadataLine(normalizedLine, metadata);
      return;
    }

    if (!headerIndex) {
      headers = normalizedLine.split("\t");
      headerIndex = createHeaderIndex(headers);
      const missingHeaders = headerNames.filter((header) => !headerIndex?.has(header));
      if (missingHeaders.length) {
        errors.push(rowError(rowNumber, line, "MISSING_HEADER", `Cabeçalho incompleto: ${missingHeaders.join(", ")}.`));
      }
      return;
    }

    totalDataRows += 1;
    if (!metadata.deviceUid) {
      errors.push(rowError(rowNumber, line, "INVALID_ROW", "DeviceUID ausente nos metadados do arquivo."));
      return;
    }

    const parsed = parsePunchRow({
      rowNumber,
      rawLine: line,
      columns: normalizedLine.split("\t"),
      headers: headerIndex,
      deviceUid: metadata.deviceUid,
    });
    if ("errorCode" in parsed) errors.push(parsed);
    else punches.push(parsed);
  });

  if (metadata.dataType !== "AttendLog") {
    errors.push({
      rowNumber: 0,
      rawLine: "",
      errorCode: "INVALID_DATA_TYPE",
      message: `DataType inválido: esperado AttendLog, recebido ${metadata.dataType ?? "ausente"}.`,
    });
  }

  if (metadata.declaredLogCount !== undefined && metadata.declaredLogCount !== totalDataRows) {
    errors.push({
      rowNumber: 0,
      rawLine: "",
      errorCode: "IMPORT_COUNT_MISMATCH",
      message: `LogCount declara ${metadata.declaredLogCount} linhas, mas foram encontradas ${totalDataRows}.`,
    });
  }

  return { encoding: decoded.encoding, metadata, headers, totalDataRows, punches, errors };
}
