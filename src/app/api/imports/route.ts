import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { SupabasePrivateStorage } from "@/lib/storage/supabase-private-storage";
import { getActiveProfile } from "@/modules/auth/server/session";
import {
  asImportFailure,
  AttendanceImportFailure,
  logImportFailure,
} from "@/modules/imports/application/import-failure";
import { executeImport } from "@/modules/imports/application/import-service";
import { readAndValidateUpload } from "@/modules/imports/application/upload-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    const profile = await getActiveProfile();
    if (!profile || !["RH_ADMIN", "RH_ANALYST"].includes(profile.role)) {
      const failure = new AttendanceImportFailure("AUTHORIZATION_FAILED", "AUTHORIZATION", requestId);
      logImportFailure(failure);
      return NextResponse.json(
        { error: { code: failure.code, message: failure.messageForUser, requestId: failure.requestId } },
        { status: failure.httpStatus },
      );
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "UNKNOWN_IMPORT_ERROR", message: "Selecione um arquivo TXT.", requestId } },
        { status: 400 },
      );
    }
    const upload = await readAndValidateUpload(file);
    const result = await executeImport({
      ...upload,
      importedById: profile.id,
      requestId,
      storage: new SupabasePrivateStorage(),
    });
    if (result.duplicateFile) {
      return NextResponse.json({
        duplicateFile: true,
        requestId: result.requestId,
        importAttemptId: result.importFile.id,
      });
    }
    return NextResponse.json({
      duplicateFile: false,
      requestId: result.requestId,
      importAttemptId: result.importFile.id,
      summary: {
        originalFilename: result.importFile.originalFilename,
        deviceUid: result.parsed.metadata.deviceUid,
        totalRows: result.importFile.totalRows,
        validRows: result.importFile.acceptedRows,
        newRows: result.importFile.acceptedRows - result.importFile.duplicatedRows,
        duplicatedRows: result.importFile.duplicatedRows,
        rejectedRows: result.importFile.rejectedRows,
        identifiedEmployees: new Set(result.parsed.punches.map((punch) => punch.externalEmployeeNumber)).size,
        provisionalEmployeesCreated: result.provisionalEmployeesCreated,
        recalculatedDays: result.recalculatedDays,
        failedCalculationDays: result.failedCalculationDays,
        calculationRunId: result.calculationRunId,
        earliestPunchAt: result.importFile.earliestPunchAt?.toISOString() ?? null,
        latestPunchAt: result.importFile.latestPunchAt?.toISOString() ?? null,
        coverageFrom: result.importFile.coverageFrom?.toISOString() ?? null,
        coverageTo: result.importFile.coverageTo?.toISOString() ?? null,
        coverageStatus: result.importFile.coverageStatus,
      },
    });
  } catch (error) {
    const failure = asImportFailure(error, {
      code: "UNKNOWN_IMPORT_ERROR",
      stage: "FINALIZATION",
      requestId,
    });
    logImportFailure(failure);
    return NextResponse.json(
      {
        error: {
          code: failure.code,
          message: failure.messageForUser,
          requestId: failure.requestId,
          importAttemptId: failure.importAttemptId,
        },
      },
      { status: failure.httpStatus },
    );
  }
}
