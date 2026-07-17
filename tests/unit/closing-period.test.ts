import { describe, expect, it } from "vitest";
import { assertPeriodCanBeChanged, canClosePeriod } from "@/modules/closing/domain/period";

describe("fechamento mensal", () => {
  it("bloqueia fechamento com inconsistência crítica aberta", () => {
    expect(canClosePeriod(true)).toBe(false);
  });

  it("bloqueia alteração normal em competência fechada", () => {
    expect(() => assertPeriodCanBeChanged("CLOSED")).toThrow("competência está fechada");
  });
});
