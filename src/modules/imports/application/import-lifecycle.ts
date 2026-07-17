import type { ImportStatus } from "@/generated/prisma/client";

export type ExistingImportAction = "CREATE" | "DUPLICATE" | "RETRY" | "IN_PROGRESS";

/** Pure lifecycle decision used before Storage and database mutation. */
export function resolveExistingImportAction(status?: ImportStatus): ExistingImportAction {
  if (!status) return "CREATE";
  if (status === "COMPLETED") return "DUPLICATE";
  if (status === "FAILED") return "RETRY";
  return "IN_PROGRESS";
}

/** A failed attempt may reuse its already-preserved private object, never creating a second copy. */
export function shouldUploadOriginal(action: ExistingImportAction, objectExists: boolean) {
  return action !== "RETRY" || !objectExists;
}
