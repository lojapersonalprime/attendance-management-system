export const IMPORT_FAILURE_CODES = [
  "AUTHORIZATION_FAILED",
  "FILE_ALREADY_IMPORTED",
  "IMPORT_IN_PROGRESS",
  "STORAGE_UPLOAD_FAILED",
  "DEVICE_UPSERT_FAILED",
  "IMPORT_FILE_CREATE_FAILED",
  "EMPLOYEE_UPSERT_FAILED",
  "DEVICE_LINK_FAILED",
  "RAW_PUNCH_INSERT_FAILED",
  "IMPORT_ERROR_INSERT_FAILED",
  "AUDIT_LOG_FAILED",
  "DAILY_RECALCULATION_FAILED",
  "DATABASE_TRANSACTION_FAILED",
  "UNKNOWN_IMPORT_ERROR",
] as const;

export type ImportFailureCode = (typeof IMPORT_FAILURE_CODES)[number];

export type ImportStage =
  | "AUTHORIZATION"
  | "FILE_VALIDATION"
  | "PREPARATION"
  | "DEVICE"
  | "IMPORT_FILE"
  | "STORAGE"
  | "EMPLOYEES"
  | "RAW_PUNCHES"
  | "IMPORT_ERRORS"
  | "AUDIT"
  | "RECALCULATION"
  | "FINALIZATION";

const messages: Record<ImportFailureCode, string> = {
  AUTHORIZATION_FAILED: "Você não possui permissão para importar arquivos.",
  FILE_ALREADY_IMPORTED: "Este arquivo já foi importado anteriormente.",
  IMPORT_IN_PROGRESS: "Este arquivo já possui uma importação em andamento. Aguarde alguns instantes antes de tentar novamente.",
  STORAGE_UPLOAD_FAILED: "Não foi possível salvar o arquivo no armazenamento privado.",
  DEVICE_UPSERT_FAILED: "A importação falhou ao identificar o equipamento.",
  IMPORT_FILE_CREATE_FAILED: "Não foi possível iniciar o registro da importação.",
  EMPLOYEE_UPSERT_FAILED: "A importação falhou durante a criação dos funcionários provisórios.",
  DEVICE_LINK_FAILED: "A importação falhou durante o vínculo dos funcionários ao equipamento.",
  RAW_PUNCH_INSERT_FAILED: "O banco recusou algumas marcações do arquivo.",
  IMPORT_ERROR_INSERT_FAILED: "Não foi possível registrar as inconsistências encontradas no arquivo.",
  AUDIT_LOG_FAILED: "Não foi possível registrar a auditoria da importação.",
  DAILY_RECALCULATION_FAILED: "As marcações foram preservadas, mas a apuração das datas afetadas falhou.",
  DATABASE_TRANSACTION_FAILED: "A importação falhou durante a gravação no banco de dados.",
  UNKNOWN_IMPORT_ERROR: "Não foi possível concluir a importação. Tente novamente.",
};

const httpStatuses: Record<ImportFailureCode, number> = {
  AUTHORIZATION_FAILED: 403,
  FILE_ALREADY_IMPORTED: 409,
  IMPORT_IN_PROGRESS: 409,
  STORAGE_UPLOAD_FAILED: 502,
  DEVICE_UPSERT_FAILED: 500,
  IMPORT_FILE_CREATE_FAILED: 500,
  EMPLOYEE_UPSERT_FAILED: 500,
  DEVICE_LINK_FAILED: 500,
  RAW_PUNCH_INSERT_FAILED: 500,
  IMPORT_ERROR_INSERT_FAILED: 500,
  AUDIT_LOG_FAILED: 500,
  DAILY_RECALCULATION_FAILED: 500,
  DATABASE_TRANSACTION_FAILED: 500,
  UNKNOWN_IMPORT_ERROR: 500,
};

export class AttendanceImportFailure extends Error {
  readonly messageForUser: string;
  readonly httpStatus: number;

  constructor(
    readonly code: ImportFailureCode,
    readonly stage: ImportStage,
    readonly requestId: string,
    readonly importAttemptId?: string,
    options?: { cause?: unknown; messageForUser?: string },
  ) {
    super(options?.messageForUser ?? messages[code], { cause: options?.cause });
    this.name = "AttendanceImportFailure";
    this.messageForUser = options?.messageForUser ?? messages[code];
    this.httpStatus = httpStatuses[code];
  }
}

function providerDetails(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const candidate = error as {
    code?: unknown;
    statusCode?: unknown;
    hint?: unknown;
    message?: unknown;
    provider?: { code?: unknown; statusCode?: unknown; hint?: unknown; message?: unknown };
  };
  const provider = candidate.provider ?? candidate;
  return {
    providerCode: typeof provider.code === "string" ? provider.code : undefined,
    providerStatus:
      typeof provider.statusCode === "number" || typeof provider.statusCode === "string" ? provider.statusCode : undefined,
    providerHint: typeof provider.hint === "string" ? provider.hint : undefined,
    technicalMessage: typeof provider.message === "string" ? provider.message : undefined,
  };
}

export function logImportFailure(error: AttendanceImportFailure) {
  const cause = error.cause;
  const details = providerDetails(cause);
  const technicalError = cause instanceof Error ? cause : undefined;
  console.error({
    event: "attendance_import_failed",
    requestId: error.requestId,
    importAttemptId: error.importAttemptId,
    stage: error.stage,
    code: error.code,
    errorType: technicalError?.name,
    ...details,
    stack: technicalError?.stack,
  });
}

export function asImportFailure(
  error: unknown,
  fallback: { code: ImportFailureCode; stage: ImportStage; requestId: string; importAttemptId?: string },
) {
  if (error instanceof AttendanceImportFailure) return error;
  return new AttendanceImportFailure(fallback.code, fallback.stage, fallback.requestId, fallback.importAttemptId, { cause: error });
}
