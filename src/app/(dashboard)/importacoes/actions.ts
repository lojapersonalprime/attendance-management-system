"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { confirmImportCoverage } from "@/modules/calculations/application/import-coverage-service";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function confirmImportCoverageAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    const result = await confirmImportCoverage({
      importFileId: text(formData, "importFileId"),
      value: { coverageFrom: text(formData, "coverageFrom"), coverageTo: text(formData, "coverageTo"), reason: text(formData, "reason") },
      context,
    });
    revalidatePath("/importacoes");
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    redirect(`/importacoes?sucesso=${encodeURIComponent(`Cobertura confirmada; ${result.calculation.processedDays} dia(s) processado(s).`)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
    const issue = error && typeof error === "object" && "issues" in error ? error.issues : undefined;
    const first = Array.isArray(issue) ? issue[0] : undefined;
    const code = first && typeof first === "object" && "path" in first && Array.isArray(first.path)
      ? first.path[0] === "reason" ? "motivo-obrigatorio" : first.path[0] === "coverageTo" ? "periodo-invalido" : "data-obrigatoria"
      : "cobertura-invalida";
    redirect(`/importacoes?erro=${code}`);
  }
}
