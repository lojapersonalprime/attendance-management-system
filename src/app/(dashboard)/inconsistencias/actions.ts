"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { updateInconsistencyStatus } from "@/modules/inconsistencies/application/inconsistency-service";
import { executeBulkIssueAction } from "@/modules/inconsistencies/application/issue-resolution-service";
import { actionErrorCode } from "@/lib/forms/action-result";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateInconsistencyStatusAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    const inconsistency = await updateInconsistencyStatus({
      value: { inconsistencyId: text(formData, "inconsistencyId"), status: text(formData, "status"), reason: text(formData, "reason") },
      context,
    });
    revalidatePath("/inconsistencias");
    revalidatePath("/apuracao");
    revalidatePath("/dashboard");
    if (inconsistency.dailySummaryId) revalidatePath(`/apuracao/${inconsistency.dailySummaryId}`);
    redirect(`/inconsistencias?sucesso=${encodeURIComponent("Inconsistência atualizada com auditoria.")}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    redirect(`/inconsistencias?erro=${actionErrorCode(error)}`);
  }
}

export async function executeBulkIssueActionAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    const result = await executeBulkIssueAction({
      value: {
        inconsistencyIds: formData.getAll("inconsistencyIds").filter((value): value is string => typeof value === "string"),
        action: text(formData, "action"),
        reason: text(formData, "reason"),
        minutesApproved: text(formData, "minutesApproved") || 0,
      },
      context,
    });
    revalidatePath("/inconsistencias");
    revalidatePath("/apuracao");
    revalidatePath("/dashboard");
    redirect(`/inconsistencias?sucesso=${encodeURIComponent(`${result.completed.length} concluída(s), ${result.ignored.length} incompatível(is), ${result.failures.length} falha(s). Solicitação ${result.requestId}.`)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    redirect(`/inconsistencias?erro=${actionErrorCode(error)}`);
  }
}
