import { describe, expect, it } from "vitest";
import { getAttendanceIssuePresentation } from "@/modules/inconsistencies/domain/presentation";

describe("apresentação humana de pendências", () => {
  it("agrupa três batidas como uma ausência de batida compreensível", () => {
    const presentation = getAttendanceIssuePresentation("MISSING_EXIT");
    expect(presentation.title).toBe("Falta uma batida para concluir o dia");
    expect(presentation.group).toBe("INCOMPLETE_DAY");
  });

  it("não expõe códigos do relógio no texto principal", () => {
    const presentation = getAttendanceIssuePresentation("INVALID_SEQUENCE");
    expect(`${presentation.title} ${presentation.description}`).not.toMatch(/\b[S|E|A|F]\b/);
  });

  it("mantém excedente como revisão, não como dia incompleto", () => {
    expect(getAttendanceIssuePresentation("EXCESS_TIME_PENDING")).toMatchObject({
      title: "Excedente aguardando aprovação",
      group: "REVIEW",
    });
  });
});
