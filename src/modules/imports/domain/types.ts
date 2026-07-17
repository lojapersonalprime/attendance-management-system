export const KNOWN_PUNCH_CODES = ["S", "E", "A", "F"] as const;

export type KnownPunchCode = (typeof KNOWN_PUNCH_CODES)[number];

export const PUNCH_DESCRIPTIONS: Record<KnownPunchCode, string> = {
  S: "Entrada inicial",
  E: "Saída para intervalo",
  A: "Retorno do intervalo",
  F: "Saída final",
};

export interface ParsedImportMetadata {
  deviceModel?: string;
  deviceUid?: string;
  dataType?: string;
  startPosition?: number;
  declaredLogCount?: number;
  limitPosition?: number;
  values: Record<string, string>;
}

export interface ParsedPunch {
  sourceRowNumber: number;
  sourceSequence?: number;
  tmNumber?: string;
  externalEmployeeNumber: string;
  employeeNameRaw?: string;
  gmNumber?: string;
  mode?: string;
  punchCode: KnownPunchCode;
  punchDescription: string;
  antipass?: string;
  daiGong?: string;
  occurredAt: Date;
  /** Device local value normalized only for matching and fingerprinting. */
  normalizedDateTime: string;
  /** Exact column content after tab splitting, including spacing between date and time. */
  originalDateTime: string;
  rawLine: string;
  fingerprint: string;
}

export interface ParsedImportError {
  rowNumber: number;
  rawLine: string;
  errorCode:
    | "INVALID_DATA_TYPE"
    | "MISSING_HEADER"
    | "INVALID_ROW"
    | "INVALID_DATETIME"
    | "UNKNOWN_PUNCH_CODE"
    | "IMPORT_COUNT_MISMATCH";
  message: string;
}

export interface ParsedAttendanceImport {
  encoding: "utf-8" | "utf-16le" | "utf-16be";
  metadata: ParsedImportMetadata;
  headers: string[];
  totalDataRows: number;
  punches: ParsedPunch[];
  errors: ParsedImportError[];
}
