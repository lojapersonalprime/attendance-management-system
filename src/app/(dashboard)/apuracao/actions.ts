"use server";

import { revalidatePath } from "next/cache";
import { redirect as nextRedirect } from "next/navigation";
import { attendanceSummaryRoute } from "@/lib/routes";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { cancelAdjustment, createAdjustment } from "@/modules/adjustments/application/adjustment-service";
import { closeCalculationPeriod, reopenCalculationPeriod } from "@/modules/closing/application/closing-service";
import { actionErrorCode } from "@/lib/forms/action-result";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectError(summaryId: string, error: unknown): never {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
  nextRedirect(attendanceSummaryRoute(summaryId, { erro: actionErrorCode(error) }));
}

export async function createAdjustmentAction(formData: FormData) {
  const summaryId = text(formData, "summaryId");
  try {
    const context = await requireAuditContext();
    await createAdjustment({
      value: { employeeId: text(formData, "employeeId"), date: text(formData, "date"), type: text(formData, "type"), originalPunchId: text(formData, "originalPunchId") || undefined, adjustedTime: text(formData, "adjustedTime"), adjustedPunchCode: text(formData, "adjustedPunchCode") || undefined, minutesCredited: text(formData, "minutesCredited") || 0, minutesDebited: text(formData, "minutesDebited") || 0, reason: text(formData, "reason") },
      context,
    });
    revalidatePath(attendanceSummaryRoute(summaryId));
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    nextRedirect(attendanceSummaryRoute(summaryId, { sucesso: "Ajuste auditado e recálculo solicitado." }));
  } catch (error) {
    redirectError(summaryId, error);
  }
}

export async function cancelAdjustmentAction(formData: FormData) {
  const summaryId = text(formData, "summaryId");
  try {
    const context = await requireAuditContext();
    await cancelAdjustment({ adjustmentId: text(formData, "adjustmentId"), reason: text(formData, "reason"), context });
    revalidatePath(attendanceSummaryRoute(summaryId));
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    nextRedirect(attendanceSummaryRoute(summaryId, { sucesso: "Ajuste cancelado; RawPunch preservado e dia recalculado." }));
  } catch (error) {
    redirectError(summaryId, error);
  }
}

export async function updateCalculationPeriodStatusAction(formData: FormData) {
  const reference = text(formData, "reference");
  try {
    const context = await requireAuditContext();
    const reason = text(formData, "reason");
    const operation = text(formData, "operation");
    if (operation === "CLOSE") {
      await closeCalculationPeriod({ reference, reason, context });
    } else if (operation === "REOPEN") {
      await reopenCalculationPeriod({ reference, reason, context });
    } else {
      throw new Error("Operação de competência inválida.");
    }
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    nextRedirect(`/apuracao?reference=${encodeURIComponent(reference)}&sucesso=${encodeURIComponent(operation === "CLOSE" ? "Competência fechada com auditoria." : "Competência reaberta com auditoria.")}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    nextRedirect(`/apuracao?reference=${encodeURIComponent(reference)}&erro=${actionErrorCode(error)}`);
  }
}
