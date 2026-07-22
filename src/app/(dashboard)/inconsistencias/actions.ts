"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { updateInconsistencyStatus } from "@/modules/inconsistencies/application/inconsistency-service";

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
    if (inconsistency.dailySummaryId) revalidatePath(`/apuracao/${inconsistency.dailySummaryId}`);
    redirect(`/inconsistencias?sucesso=${encodeURIComponent("Inconsistência atualizada com auditoria.")}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    redirect(`/inconsistencias?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível atualizar a inconsistência.")}`);
  }
}
