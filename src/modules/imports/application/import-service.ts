import "server-only";

import { randomUUID } from "node:crypto";
import { toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import type { PrivateStorage } from "@/lib/storage/private-storage";
import { recalculateAffectedDays } from "@/modules/calculations/application/recalculate-persisted-attendance";
import {
  asImportFailure,
  AttendanceImportFailure,
  type ImportFailureCode,
  type ImportStage,
} from "@/modules/imports/application/import-failure";
import { resolveExistingImportAction, shouldUploadOriginal } from "@/modules/imports/application/import-lifecycle";
import { previewImport } from "@/modules/imports/application/preview";

interface ExecuteImportInput {
  content: Buffer;
  originalFilename: string;
  safeFilename: string;
  importedById: string;
  requestId?: string;
  storage: PrivateStorage;
}

interface ImportCounters {
  provisionalEmployeesCreated: number;
  rawPunchesInserted: number;
  duplicatedRows: number;
}

function importErrorInconsistencyType(errorCode: string) {
  if (errorCode === "INVALID_DATETIME") return "INVALID_DATETIME" as const;
  if (errorCode === "UNKNOWN_PUNCH_CODE") return "UNKNOWN_PUNCH_CODE" as const;
  if (errorCode === "IMPORT_COUNT_MISMATCH") return "IMPORT_COUNT_MISMATCH" as const;
  return "INVALID_ROW" as const;
}

function stageFailure(
  code: ImportFailureCode,
  stage: ImportStage,
  requestId: string,
  importAttemptId?: string,
  cause?: unknown,
) {
  return new AttendanceImportFailure(code, stage, requestId, importAttemptId, { cause });
}

function dateOnlyFromPunch(date: Date) {
  return new Date(`${toBusinessDate(date)}T00:00:00.000Z`);
}

function earliestAndLatest(punches: readonly { occurredAt: Date }[]) {
  return punches.reduce<{ earliest?: Date; latest?: Date }>((period, punch) => ({
    earliest: !period.earliest || punch.occurredAt < period.earliest ? punch.occurredAt : period.earliest,
    latest: !period.latest || punch.occurredAt > period.latest ? punch.occurredAt : period.latest,
  }), {});
}

async function recordFailure(input: {
  importFileId?: string;
  importedById: string;
  requestId: string;
  failure: AttendanceImportFailure;
}) {
  if (!input.importFileId) return;
  const importFileId = input.importFileId;
  const prisma = getPrisma();
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.importFile.update({
        where: { id: importFileId },
        data: {
          status: "FAILED",
          failureCode: input.failure.code,
          failureStage: input.failure.stage,
          failureMessage: input.failure.messageForUser,
          requestId: input.requestId,
          finishedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          userId: input.importedById,
          action: "IMPORT_FAILED",
          entityType: "ImportFile",
          entityId: importFileId,
          newData: { code: input.failure.code, stage: input.failure.stage, requestId: input.requestId },
          reason: input.failure.messageForUser,
        },
      });
    });
  } catch (error) {
    console.error({
      event: "attendance_import_failure_recording_failed",
      requestId: input.requestId,
      importAttemptId: input.importFileId,
      errorType: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Imports one AttendLog file through recoverable PROCESSING/FAILED/COMPLETED states.
 * The original object is uploaded outside database transactions. Raw punches are immutable.
 */
export async function executeImport(input: ExecuteImportInput) {
  const requestId = input.requestId ?? randomUUID();
  const { fileHash, parsed } = previewImport(input.content);
  if (!parsed.metadata.deviceUid || parsed.metadata.dataType !== "AttendLog") {
    throw stageFailure("UNKNOWN_IMPORT_ERROR", "PREPARATION", requestId);
  }

  const deviceUid = parsed.metadata.deviceUid;
  const { earliest: earliestPunchAt, latest: latestPunchAt } = earliestAndLatest(parsed.punches);
  const year = earliestPunchAt ? Number(toBusinessDate(earliestPunchAt).slice(0, 4)) : new Date().getUTCFullYear();
  const storagePath = `attendance-imports/${deviceUid}/${year}/${fileHash}-${input.safeFilename}`;
  const prisma = getPrisma();
  let importAttemptId: string | undefined;

  try {
    const device = await prisma.device.upsert({
      where: { deviceUid },
      update: { model: parsed.metadata.deviceModel ?? undefined },
      create: { deviceUid, model: parsed.metadata.deviceModel, name: `Relógio ${deviceUid}` },
    }).catch((error: unknown) => {
      throw stageFailure("DEVICE_UPSERT_FAILED", "DEVICE", requestId, undefined, error);
    });

    const existing = await prisma.importFile.findUnique({ where: { fileHash } }).catch((error: unknown) => {
      throw stageFailure("DATABASE_TRANSACTION_FAILED", "IMPORT_FILE", requestId, undefined, error);
    });
    const existingAction = resolveExistingImportAction(existing?.status);
    if (existingAction === "DUPLICATE" && existing) {
      return { duplicateFile: true as const, importFile: existing, parsed, requestId };
    }
    if (existingAction === "IN_PROGRESS" && existing) {
      throw stageFailure("IMPORT_IN_PROGRESS", "IMPORT_FILE", requestId, existing.id);
    }

    const importFile = existing
      ? await prisma.importFile.update({
          where: { id: existing.id },
          data: {
            deviceId: device.id,
            originalFilename: input.originalFilename,
            safeFilename: input.safeFilename,
            storagePath,
            status: "PROCESSING",
            dataType: parsed.metadata.dataType,
            startPosition: parsed.metadata.startPosition,
            declaredLogCount: parsed.metadata.declaredLogCount,
            limitPosition: parsed.metadata.limitPosition,
            totalRows: parsed.totalDataRows,
            acceptedRows: parsed.punches.length,
            duplicatedRows: 0,
            rejectedRows: parsed.errors.filter((error) => error.rowNumber > 0).length,
            earliestPunchAt,
            latestPunchAt,
            importedById: input.importedById,
            failureCode: null,
            failureStage: null,
            failureMessage: null,
            requestId,
            startedAt: new Date(),
            finishedAt: null,
          },
        }).catch((error: unknown) => {
          throw stageFailure("IMPORT_FILE_CREATE_FAILED", "IMPORT_FILE", requestId, existing.id, error);
        })
      : await prisma.importFile.create({
          data: {
            deviceId: device.id,
            originalFilename: input.originalFilename,
            safeFilename: input.safeFilename,
            fileHash,
            storagePath,
            status: "PROCESSING",
            dataType: parsed.metadata.dataType,
            startPosition: parsed.metadata.startPosition,
            declaredLogCount: parsed.metadata.declaredLogCount,
            limitPosition: parsed.metadata.limitPosition,
            totalRows: parsed.totalDataRows,
            acceptedRows: parsed.punches.length,
            rejectedRows: parsed.errors.filter((error) => error.rowNumber > 0).length,
            earliestPunchAt,
            latestPunchAt,
            importedById: input.importedById,
            requestId,
          },
        }).catch((error: unknown) => {
          throw stageFailure("IMPORT_FILE_CREATE_FAILED", "IMPORT_FILE", requestId, undefined, error);
        });
    importAttemptId = importFile.id;

    const alreadyStored = existingAction === "RETRY" ? await input.storage.exists(storagePath) : false;
    if (shouldUploadOriginal(existingAction, alreadyStored)) {
      // The private bucket is intentionally restricted to text/plain. The original UTF-16 bytes
      // are preserved unchanged; the charset parameter would be rejected by Storage allow-lists.
      await input.storage.upload(storagePath, input.content, "text/plain").catch((error: unknown) => {
        throw stageFailure("STORAGE_UPLOAD_FAILED", "STORAGE", requestId, importFile.id, error);
      });
    }

    const counters = await prisma.$transaction(async (transaction): Promise<ImportCounters> => {
      const externalNumbers = [...new Set(parsed.punches.map((punch) => punch.externalEmployeeNumber))];
      const existingLinks = await transaction.employeeDeviceLink.findMany({
        where: { deviceId: device.id, externalEmployeeNumber: { in: externalNumbers } },
      }).catch((error: unknown) => {
        throw stageFailure("DEVICE_LINK_FAILED", "EMPLOYEES", requestId, importFile.id, error);
      });
      const links = new Map(existingLinks.map((link) => [link.externalEmployeeNumber, { id: link.id, employeeId: link.employeeId }]));
      let provisionalEmployeesCreated = 0;

      const firstPunchByExternalNumber = new Map<string, (typeof parsed.punches)[number]>();
      for (const punch of parsed.punches) {
        const current = firstPunchByExternalNumber.get(punch.externalEmployeeNumber);
        if (!current || punch.occurredAt < current.occurredAt) firstPunchByExternalNumber.set(punch.externalEmployeeNumber, punch);
      }

      for (const externalNumber of externalNumbers) {
        if (links.has(externalNumber)) continue;
        const punch = firstPunchByExternalNumber.get(externalNumber);
        if (!punch) continue;
        const employee = await transaction.employee.create({
          data: {
            fullName: punch.employeeNameRaw || `Cadastro pendente — EnNo ${externalNumber}`,
            status: "PENDING",
            provisional: true,
          },
        }).catch((error: unknown) => {
          throw stageFailure("EMPLOYEE_UPSERT_FAILED", "EMPLOYEES", requestId, importFile.id, error);
        });
        const link = await transaction.employeeDeviceLink.create({
          data: {
            employeeId: employee.id,
            deviceId: device.id,
            externalEmployeeNumber: externalNumber,
            externalEmployeeName: punch.employeeNameRaw,
            validFrom: dateOnlyFromPunch(punch.occurredAt),
          },
        }).catch((error: unknown) => {
          throw stageFailure("DEVICE_LINK_FAILED", "EMPLOYEES", requestId, importFile.id, error);
        });
        links.set(externalNumber, { id: link.id, employeeId: link.employeeId });
        provisionalEmployeesCreated += 1;
      }

      await transaction.rawPunch.createMany({
        data: parsed.punches.map((punch) => ({
          importFileId: importFile.id,
          deviceId: device.id,
          employeeDeviceLinkId: links.get(punch.externalEmployeeNumber)?.id,
          externalEmployeeNumber: punch.externalEmployeeNumber,
          employeeNameRaw: punch.employeeNameRaw,
          sourceSequence: punch.sourceSequence,
          tmNumber: punch.tmNumber,
          gmNumber: punch.gmNumber,
          mode: punch.mode,
          punchCode: punch.punchCode,
          punchDescription: punch.punchDescription,
          antipass: punch.antipass,
          daiGong: punch.daiGong,
          occurredAt: punch.occurredAt,
          originalDateTime: punch.originalDateTime,
          rawLine: punch.rawLine,
          fingerprint: punch.fingerprint,
        })),
        skipDuplicates: true,
      }).catch((error: unknown) => {
        throw stageFailure("RAW_PUNCH_INSERT_FAILED", "RAW_PUNCHES", requestId, importFile.id, error);
      });

      await transaction.importError.createMany({
        data: parsed.errors.map((error) => ({
          importFileId: importFile.id,
          rowNumber: error.rowNumber,
          rawLine: error.rawLine || null,
          errorCode: error.errorCode,
          message: error.message,
        })),
      }).catch((error: unknown) => {
        throw stageFailure("IMPORT_ERROR_INSERT_FAILED", "IMPORT_ERRORS", requestId, importFile.id, error);
      });

      const rowErrors = parsed.errors.filter((error) => error.rowNumber > 0);
      if (rowErrors.length > 0) {
        await transaction.inconsistency.createMany({
          data: rowErrors.map((error) => ({
            importFileId: importFile.id,
            type: importErrorInconsistencyType(error.errorCode),
            severity: error.errorCode === "IMPORT_COUNT_MISMATCH" ? "WARNING" : "CRITICAL",
            status: "OPEN",
            description: error.message,
            metadata: { source: "IMPORT", rowNumber: error.rowNumber, errorCode: error.errorCode },
          })),
        }).catch((error: unknown) => {
          throw stageFailure("IMPORT_ERROR_INSERT_FAILED", "IMPORT_ERRORS", requestId, importFile.id, error);
        });
      }

      const rawPunchesInserted = await transaction.rawPunch.count({ where: { importFileId: importFile.id } });
      return {
        provisionalEmployeesCreated,
        rawPunchesInserted,
        duplicatedRows: parsed.punches.length - rawPunchesInserted,
      };
    }, { timeout: 60_000 }).catch((error: unknown) => {
      throw asImportFailure(error, {
        code: "DATABASE_TRANSACTION_FAILED",
        stage: "RAW_PUNCHES",
        requestId,
        importAttemptId: importFile.id,
      });
    });

    const recalculation = await prisma.$transaction(async (transaction) => {
      const employeeLinks = await transaction.employeeDeviceLink.findMany({
        where: { deviceId: device.id, externalEmployeeNumber: { in: [...new Set(parsed.punches.map((punch) => punch.externalEmployeeNumber))] } },
        select: { employeeId: true, externalEmployeeNumber: true },
      });
      const linksByExternalNumber = new Map(employeeLinks.map((link) => [link.externalEmployeeNumber, link]));
      return recalculateAffectedDays(
        transaction,
        parsed.punches.flatMap((punch) => {
          const link = linksByExternalNumber.get(punch.externalEmployeeNumber);
          return link ? [{ employeeId: link.employeeId, date: toBusinessDate(punch.occurredAt) }] : [];
        }),
        { importFileId: importFile.id },
      );
    }, { timeout: 60_000 }).catch((error: unknown) => {
      throw asImportFailure(error, {
        code: "DAILY_RECALCULATION_FAILED",
        stage: "RECALCULATION",
        requestId,
        importAttemptId: importFile.id,
      });
    });

    const completedImport = await prisma.$transaction(async (transaction) => {
      const completed = await transaction.importFile.update({
        where: { id: importFile.id },
        data: {
          duplicatedRows: counters.duplicatedRows,
          status: "COMPLETED",
          failureCode: null,
          failureStage: null,
          failureMessage: null,
          finishedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          userId: input.importedById,
          action: "IMPORT_COMPLETED",
          entityType: "ImportFile",
          entityId: completed.id,
          newData: {
            requestId,
            totalRows: parsed.totalDataRows,
            newRows: counters.rawPunchesInserted,
            duplicatedRows: counters.duplicatedRows,
            rejectedRows: parsed.errors.filter((error) => error.rowNumber > 0).length,
            recalculatedDays: recalculation.recalculatedDays,
          },
        },
      }).catch((error: unknown) => {
        throw stageFailure("AUDIT_LOG_FAILED", "AUDIT", requestId, importFile.id, error);
      });
      return completed;
    }).catch((error: unknown) => {
      throw asImportFailure(error, {
        code: "AUDIT_LOG_FAILED",
        stage: "FINALIZATION",
        requestId,
        importAttemptId: importFile.id,
      });
    });

    return {
      duplicateFile: false as const,
      importFile: completedImport,
      parsed,
      requestId,
      provisionalEmployeesCreated: counters.provisionalEmployeesCreated,
      rawPunchesInserted: counters.rawPunchesInserted,
      recalculatedDays: recalculation.recalculatedDays,
    };
  } catch (error) {
    const failure = asImportFailure(error, {
      code: "UNKNOWN_IMPORT_ERROR",
      stage: "FINALIZATION",
      requestId,
      importAttemptId,
    });
    await recordFailure({ importFileId: failure.importAttemptId ?? importAttemptId, importedById: input.importedById, requestId, failure });
    throw failure;
  }
}
