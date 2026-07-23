import { describe, expect, it } from "vitest";

import { isActionableInconsistencyStatus } from "@/modules/inconsistencies/domain/status";

describe("status de inconsistência acionável", () => {
  it.each(["OPEN", "REOPENED", "IN_REVIEW"])("inclui %s na fila de revisão", (status) => {
    expect(isActionableInconsistencyStatus(status)).toBe(true);
  });

  it.each(["RESOLVED", "AUTO_RESOLVED", "DISMISSED"])("não inclui %s na fila de revisão", (status) => {
    expect(isActionableInconsistencyStatus(status)).toBe(false);
  });
});
