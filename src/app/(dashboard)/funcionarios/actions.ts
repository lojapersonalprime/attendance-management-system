"use server";

import { revalidatePath } from "next/cache";
import { redirect as nextRedirect } from "next/navigation";
import type { Route } from "next";
import { employeeRoute, employeesRoute, employeesRouteWithQuery, newEmployeeRoute, schedulesRoute } from "@/lib/routes";
import { requireAuditContext } from "@/modules/audit/server/request-context";
import { recalculateEmployeePeriod } from "@/modules/calculations/application/controlled-recalculation";
import { executeBulkEmployeeAction } from "@/modules/employees/application/bulk-service";
import { setEmployeeTag } from "@/modules/employees/application/directory-service";
import { createEmployeeDeviceLink, endEmployeeDeviceLink } from "@/modules/employees/application/device-link-service";
import { completeProvisionalEmployee, createManualEmployee, setEmployeeStatus, updateEmployee } from "@/modules/employees/application/employee-service";
import { mergeEmployees } from "@/modules/employees/application/merge-service";
import { assignScheduleToEmployee, retryScheduleAssignmentCalculation } from "@/modules/schedules/application/schedule-service";
import { createEmploymentPeriod } from "@/modules/calculations/application/employment-period-service";
import { actionErrorCode } from "@/lib/forms/action-result";
import { normalizeScheduleAssignmentDate, parseScheduleAssignmentFormData } from "@/modules/schedules/application/schedule-assignment-form";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function redirect(path: Route): never {
  return nextRedirect(path);
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function employeeValue(formData: FormData) {
  return {
    fullName: text(formData, "fullName"),
    clockNameRaw: text(formData, "clockNameRaw"),
    registration: text(formData, "registration"),
    cpf: text(formData, "cpf"),
    employmentType: text(formData, "employmentType"),
    status: text(formData, "status"),
    positionId: text(formData, "positionId"),
    departmentId: text(formData, "departmentId"),
    unitId: text(formData, "unitId"),
    admissionDate: text(formData, "admissionDate"),
    terminationDate: text(formData, "terminationDate"),
    notes: text(formData, "notes"),
    tagIds: formData.getAll("tagIds").filter((value): value is string => typeof value === "string"),
  };
}

function withError(path: Route, error: unknown): never {
  if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) {
    throw error;
  }
  const [pathname, currentQuery] = path.split("?", 2);
  const query = new URLSearchParams(currentQuery);
  query.set("erro", actionErrorCode(error));
  redirect(`${pathname}?${query.toString()}` as Route);
}

export async function createEmployeeAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    const employee = await createManualEmployee(employeeValue(formData), context);
    revalidatePath(employeesRoute);
    redirect(employeeRoute(employee.id, { sucesso: "Funcionário criado com sucesso." }));
  } catch (error) {
    withError(newEmployeeRoute, error);
  }
}

export async function updateEmployeeAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await updateEmployee(employeeId, employeeValue(formData), context);
    revalidatePath(employeesRoute);
    revalidatePath(employeeRoute(employeeId));
    redirect(employeeRoute(employeeId, { sucesso: "Dados atualizados." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "dados" }), error);
  }
}

export async function completeProvisionalEmployeeAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await completeProvisionalEmployee(employeeId, employeeValue(formData), context);
    revalidatePath(employeesRoute);
    revalidatePath(employeeRoute(employeeId));
    redirect(employeeRoute(employeeId, { sucesso: "Cadastro provisório concluído. A jornada continua pendente até ser atribuída." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "dados" }), error);
  }
}

export async function changeEmployeeStatusAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await setEmployeeStatus({ employeeId, status: text(formData, "status"), terminationDate: text(formData, "terminationDate"), reason: text(formData, "reason") ?? "", context });
    revalidatePath(employeesRoute);
    revalidatePath(employeeRoute(employeeId));
    redirect(employeeRoute(employeeId, { sucesso: "Status atualizado." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "dados" }), error);
  }
}

export async function createDeviceLinkAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await createEmployeeDeviceLink(employeeId, { deviceId: text(formData, "deviceId"), externalEmployeeNumber: text(formData, "externalEmployeeNumber"), externalEmployeeName: text(formData, "externalEmployeeName"), validFrom: text(formData, "validFrom"), validUntil: text(formData, "validUntil") }, context);
    revalidatePath(employeeRoute(employeeId));
    revalidatePath(employeesRoute);
    redirect(employeeRoute(employeeId, { aba: "vinculos", sucesso: "Vínculo com relógio criado." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "vinculos" }), error);
  }
}

export async function endDeviceLinkAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await endEmployeeDeviceLink({ linkId: text(formData, "linkId") ?? "", validUntil: text(formData, "validUntil") ?? "", reason: text(formData, "reason") ?? "", context });
    revalidatePath(employeeRoute(employeeId));
    revalidatePath(employeesRoute);
    redirect(employeeRoute(employeeId, { aba: "vinculos", sucesso: "Vínculo encerrado e mantido no histórico." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "vinculos" }), error);
  }
}

export async function setTagAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await setEmployeeTag({ employeeId, tagId: text(formData, "tagId") ?? "", assigned: text(formData, "operation") === "add", reason: text(formData, "reason"), context });
    revalidatePath(employeeRoute(employeeId));
    revalidatePath(employeesRoute);
    redirect(employeeRoute(employeeId, { aba: "tags", sucesso: "Tags atualizadas." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "tags" }), error);
  }
}

export async function assignScheduleAction(formData: FormData) {
  const submittedEmployeeId = text(formData, "employeeId");
  if (!submittedEmployeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    const submitted = parseScheduleAssignmentFormData(formData);
    const assignment = await assignScheduleToEmployee({
      employeeId: submitted.employeeId,
      value: submitted.assignment,
      context,
      recalculateAffectedDays: submitted.recalculateAffectedDays,
      recalculateUntil: submitted.recalculateUntil,
    });
    revalidatePath(employeeRoute(submitted.employeeId));
    revalidatePath(employeesRoute);
    revalidatePath(schedulesRoute);
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    const message = assignment.calculation.status === "FAILED"
      ? "Jornada atribuída. O recálculo não foi concluído e pode ser tentado novamente."
      : assignment.calculation.status === "PARTIAL"
        ? `Jornada atribuída. ${assignment.calculation.processedDays} dia(s) foram recalculados e alguns permanecem pendentes.`
        : assignment.calculation.status === "NOT_REQUESTED"
          ? "Jornada atribuída. O recálculo ficou pendente até que haja dias elegíveis para processamento."
          : `Jornada atribuída e ${assignment.calculation.processedDays} dia(s) afetado(s) recalculado(s).`;
    redirect(employeeRoute(submitted.employeeId, { aba: "jornada", sucesso: message }));
  } catch (error) {
    withError(employeeRoute(submittedEmployeeId, { aba: "jornada" }), error);
  }
}

export async function retryScheduleCalculationAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const validFrom = normalizeScheduleAssignmentDate(text(formData, "validFrom") ?? "", "data de início", true);
    if (!validFrom) throw new Error("Informe a data de início.");
    const validUntil = normalizeScheduleAssignmentDate(text(formData, "validUntil") ?? "", "data final");
    if (validUntil && validUntil < validFrom) throw new Error("A data final não pode ser anterior à data de início.");
    const context = await requireAuditContext();
    const result = await retryScheduleAssignmentCalculation({ employeeId, validFrom, validUntil, context });
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    const message = result.calculation.status === "FAILED"
      ? "A nova tentativa de recálculo falhou. A jornada permanece salva."
      : result.calculation.status === "NOT_REQUESTED"
        ? "Não há dias elegíveis para recalcular. Confira a cobertura, o vínculo e a política."
        : `Recálculo concluído para ${result.calculation.processedDays} dia(s).`;
    redirect(employeeRoute(employeeId, { aba: "jornada", sucesso: message }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "jornada" }), error);
  }
}

export async function createEmploymentPeriodAction(formData: FormData) {
  const employeeId = text(formData, "employeeId") ?? "";
  try {
    const context = await requireAuditContext();
    const result = await createEmploymentPeriod({
      employeeId,
      value: {
        employmentType: text(formData, "employmentType"),
        calculationPolicyId: text(formData, "calculationPolicyId"),
        validFrom: text(formData, "validFrom"),
        validUntil: text(formData, "validUntil") ?? "",
        reason: text(formData, "reason"),
        notes: text(formData, "notes"),
        closePrevious: checked(formData, "closePrevious"),
        retroactiveConfirmed: checked(formData, "retroactiveConfirmed"),
      },
      context,
    });
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    redirect(employeeRoute(employeeId, { aba: "contrato", sucesso: `Vínculo salvo; ${result.calculation.processedDays} dia(s) processado(s).` }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "contrato" }), error);
  }
}

export async function recalculateEmployeeAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await recalculateEmployeePeriod({ employeeId, validFrom: text(formData, "validFrom") ?? "", validUntil: text(formData, "validUntil") ?? "", reason: text(formData, "reason") ?? "", context });
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    redirect(employeeRoute(employeeId, { aba: "apuracao", sucesso: "Período recalculado. Competências fechadas foram preservadas." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "apuracao" }), error);
  }
}

export async function mergeEmployeesAction(formData: FormData) {
  const primaryEmployeeId = text(formData, "primaryEmployeeId");
  if (!primaryEmployeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await mergeEmployees({ primaryEmployeeId, secondaryEmployeeId: text(formData, "secondaryEmployeeId"), reason: text(formData, "reason") }, context);
    revalidatePath(employeesRoute);
    revalidatePath(employeeRoute(primaryEmployeeId));
    redirect(employeeRoute(primaryEmployeeId, { sucesso: "Cadastros mesclados com histórico preservado." }));
  } catch (error) {
    withError(employeeRoute(primaryEmployeeId, { aba: "dados" }), error);
  }
}

export async function bulkEmployeeAction(formData: FormData) {
  try {
    const context = await requireAuditContext();
    const action = text(formData, "bulkAction");
    const employeeIds = formData.getAll("employeeIds").filter((value): value is string => typeof value === "string");
    const result = await executeBulkEmployeeAction({
      employeeIds,
      action,
      value: text(formData, "bulkValue"),
      terminationDate: text(formData, "terminationDate"),
      reason: text(formData, "reason"),
      schedule: { scheduleTemplateId: text(formData, "scheduleTemplateId"), validFrom: text(formData, "validFrom"), validUntil: text(formData, "validUntil"), reason: text(formData, "reason"), closePrevious: checked(formData, "closePrevious"), retroactiveConfirmed: checked(formData, "retroactiveConfirmed") },
      period: { validFrom: text(formData, "validFrom") ?? "", validUntil: text(formData, "validUntil") ?? "" },
    }, context);
    revalidatePath(employeesRoute);
    revalidatePath("/apuracao");
    redirect(employeesRouteWithQuery({ sucesso: `${result.succeeded.length} registro(s) processado(s); ${result.failures.length} falha(s).` }));
  } catch (error) {
    withError(employeesRoute, error);
  }
}
