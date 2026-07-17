import { describe, expect, it } from "vitest";
import { AttendanceImportFailure, asImportFailure } from "@/modules/imports/application/import-failure";
import { resolveExistingImportAction, shouldUploadOriginal } from "@/modules/imports/application/import-lifecycle";

describe("ciclo de vida da importação persistida", () => {
  it("não cria uma nova importação nem reenvia Storage para arquivo concluído", () => {
    expect(resolveExistingImportAction("COMPLETED")).toBe("DUPLICATE");
  });

  it("mantém uma tentativa falha recuperável e reutiliza o objeto privado existente", () => {
    const action = resolveExistingImportAction("FAILED");
    expect(action).toBe("RETRY");
    expect(shouldUploadOriginal(action, true)).toBe(false);
    expect(shouldUploadOriginal(action, false)).toBe(true);
  });

  it("bloqueia tentativa simultânea", () => {
    expect(resolveExistingImportAction("PROCESSING")).toBe("IN_PROGRESS");
  });
});

describe("falhas estruturadas da importação", () => {
  it("mantém erro de Storage seguro para o navegador", () => {
    const failure = new AttendanceImportFailure("STORAGE_UPLOAD_FAILED", "STORAGE", "request-test", "attempt-test", {
      cause: new Error("storage provider failure"),
    });
    expect(failure.httpStatus).toBe(502);
    expect(failure.messageForUser).toBe("Não foi possível salvar o arquivo no armazenamento privado.");
    expect(failure.requestId).toBe("request-test");
  });

  it("representa Profile inexistente ou inativo como falha de autorização", () => {
    const failure = new AttendanceImportFailure("AUTHORIZATION_FAILED", "AUTHORIZATION", "request-test");
    expect(failure.httpStatus).toBe(403);
  });

  it("preserva uma falha específica após upload em vez de escondê-la", () => {
    const original = new AttendanceImportFailure("DAILY_RECALCULATION_FAILED", "RECALCULATION", "request-test", "attempt-test");
    expect(asImportFailure(original, { code: "UNKNOWN_IMPORT_ERROR", stage: "FINALIZATION", requestId: "other" })).toBe(original);
  });
});
