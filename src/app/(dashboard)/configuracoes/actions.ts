"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { saveDirectoryEntry, setDirectoryEntryActive, type DirectoryKind } from "@/modules/employees/application/directory-service";
import { ensureDefaultCalculationPolicies } from "@/modules/calculations/application/policy-service";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function kind(value: string | undefined): DirectoryKind {
  if (value === "UNIT" || value === "DEPARTMENT" || value === "POSITION" || value === "TAG") return value;
  throw new Error("Tipo de configuração inválido.");
}

function redirectError(error: unknown): never {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error;
  redirect(`/configuracoes?erro=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível salvar a configuração.")}`);
}

export async function saveDirectoryAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    await saveDirectoryEntry({ kind: kind(text(formData, "kind")), id: text(formData, "id"), name: text(formData, "name") ?? "", description: text(formData, "description"), context });
    revalidatePath("/configuracoes");
    revalidatePath("/funcionarios");
    redirect("/configuracoes?sucesso=Configuração%20salva.");
  } catch (error) {
    redirectError(error);
  }
}

export async function toggleDirectoryAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    await setDirectoryEntryActive({ kind: kind(text(formData, "kind")), id: text(formData, "id") ?? "", active: text(formData, "active") === "true", reason: text(formData, "reason"), context });
    revalidatePath("/configuracoes");
    revalidatePath("/funcionarios");
    redirect("/configuracoes?sucesso=Status%20atualizado.");
  } catch (error) {
    redirectError(error);
  }
}

export async function ensureCalculationPoliciesAction() {
  try {
    const context = await requireAuditContext();
    const policies = await ensureDefaultCalculationPolicies(context);
    revalidatePath("/configuracoes");
    redirect(`/configuracoes?sucesso=${encodeURIComponent(`${policies.length} políticas iniciais disponíveis.`)}`);
  } catch (error) {
    redirectError(error);
  }
}
