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
import { completeProvisionalEmployee, createManualEmployee, removeEmployee, setEmployeeStatus, updateEmployee } from "@/modules/employees/application/employee-service";
import { mergeEmployees } from "@/modules/employees/application/merge-service";
import { assignScheduleToEmployee, retryScheduleAssignmentCalculation } from "@/modules/schedules/application/schedule-service";
import { createEmploymentPeriod } from "@/modules/calculations/application/employment-period-service";
import { actionErrorCode } from "@/lib/forms/action-result";
import { resolveDailyIssue } from "@/modules/inconsistencies/application/issue-resolution-service";
import { normalizeScheduleAssignmentDate, parseScheduleAssignmentFormData } from "@/modules/schedules/application/schedule-assignment-form";
import { createOrLinkEmployeeMobileAccount, setEmployeeMobileAccessActive, setEmployeeMobileAccessPin, setEmployeeMobileAuthorizedLocation } from "@/modules/mobile-attendance/application/mobile-attendance-service";

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
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: "Dados do funcionário atualizados." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
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
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
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
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
  }
}

export async function removeEmployeeAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  if (!employeeId) withError(employeesRoute, new Error("Funcionário inválido."));
  try {
    const context = await requireAuditContext();
    await removeEmployee({ employeeId, confirmationName: text(formData, "confirmationName") }, context);
    revalidatePath(employeesRoute);
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/dashboard");
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    revalidatePath("/visao-hoje");
    revalidatePath("/api/exports/monthly");
    redirect(employeesRouteWithQuery({ sucesso: "Funcionário excluído definitivamente." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
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
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: "Vínculo com relógio criado." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
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
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: "Vínculo encerrado e mantido no histórico." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
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
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: "Tags atualizadas." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
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
      recalculateAffectedDays: true,
      recalculateUntil: submitted.recalculateUntil,
    });
    revalidatePath(employeeRoute(submitted.employeeId));
    revalidatePath(employeesRoute);
    revalidatePath(schedulesRoute);
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    const message = assignment.calculation.status === "FAILED"
      ? "Modelo atribuído com sucesso. O recálculo não foi concluído e pode ser tentado novamente."
      : assignment.calculation.status === "PARTIAL"
        ? `Modelo atribuído com sucesso. ${assignment.calculation.processedDays} dia(s) foram recalculados e alguns permanecem pendentes.`
        : assignment.calculation.status === "NOT_REQUESTED"
          ? "Modelo atribuído com sucesso. O recálculo aguarda dias elegíveis para processamento."
          : `Modelo atribuído com sucesso e ${assignment.calculation.processedDays} dia(s) afetado(s) foram recalculados.`;
    redirect(employeeRoute(submitted.employeeId, { aba: "horario", sucesso: message }));
  } catch (error) {
    withError(employeeRoute(submittedEmployeeId, { aba: "horario" }), error);
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
    redirect(employeeRoute(employeeId, { aba: "horario", sucesso: message }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "horario" }), error);
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
    const message = result.calculation.status === "FAILED"
      ? "Vínculo salvo. O cálculo não foi concluído e pode ser solicitado novamente."
      : result.calculation.processedDays > 0
        ? `Vínculo salvo. ${result.calculation.processedDays} dia(s) foram processados.`
        : "Vínculo salvo. O cálculo aguarda modelo de horário, cobertura ou dias elegíveis.";
    redirect(employeeRoute(employeeId, { aba: "horario", sucesso: message }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "horario" }), error);
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
    redirect(employeeRoute(employeeId, { aba: "registro", sucesso: "Período recalculado. Competências fechadas foram preservadas." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "registro" }), error);
  }
}

export async function createOrLinkEmployeeMobileAccountAction(formData: FormData) {
  const employeeId = text(formData, "employeeId") ?? "";
  try {
    const context = await requireAuditContext();
    const result = await createOrLinkEmployeeMobileAccount({ employeeId, email: text(formData, "email") }, context);
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/funcionarios");
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: result.active ? "Conta de acesso já estava vinculada." : "Conta de acesso configurada. Defina o PIN e o local autorizado." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
  }
}

export async function setEmployeeMobileAccessPinAction(formData: FormData) {
  const employeeId = text(formData, "employeeId") ?? "";
  try {
    const context = await requireAuditContext();
    await setEmployeeMobileAccessPin({ employeeId, pin: text(formData, "pin"), confirmPin: text(formData, "confirmPin") }, context);
    revalidatePath(employeeRoute(employeeId));
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: "PIN configurado com segurança." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
  }
}

export async function setEmployeeMobileAuthorizedLocationAction(formData: FormData) {
  const employeeId = text(formData, "employeeId") ?? "";
  try {
    const context = await requireAuditContext();
    await setEmployeeMobileAuthorizedLocation({ employeeId, authorizedLocationId: text(formData, "authorizedLocationId") }, context);
    revalidatePath(employeeRoute(employeeId));
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: "Local autorizado configurado." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
  }
}

export async function setEmployeeMobileAccessActiveAction(formData: FormData) {
  const employeeId = text(formData, "employeeId") ?? "";
  try {
    const context = await requireAuditContext();
    const active = checked(formData, "active");
    await setEmployeeMobileAccessActive({ employeeId, active }, context);
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/funcionarios");
    redirect(employeeRoute(employeeId, { aba: "funcionario", sucesso: active ? "Acesso ao ponto pelo celular ativado." : "Acesso ao ponto pelo celular desativado." }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "funcionario" }), error);
  }
}

export async function resolveEmployeeDailyIssueAction(formData: FormData) {
  const employeeId = text(formData, "employeeId");
  const summaryId = text(formData, "summaryId");
  if (!employeeId || !summaryId) withError(employeesRoute, new Error("Registro diário inválido."));
  try {
    const context = await requireAuditContext();
    const result = await resolveDailyIssue({
      value: {
        inconsistencyId: text(formData, "inconsistencyId"),
        action: text(formData, "action"),
        reason: text(formData, "reason"),
        adjustedTime: text(formData, "adjustedTime") ?? "",
        adjustedPunchCode: text(formData, "adjustedPunchCode"),
        originalPunchId: text(formData, "originalPunchId"),
        minutesApproved: text(formData, "minutesApproved") ?? 0,
      },
      context,
    });
    revalidatePath(employeeRoute(employeeId));
    revalidatePath("/apuracao");
    revalidatePath("/inconsistencias");
    revalidatePath("/dashboard");
    redirect(employeeRoute(employeeId, { aba: "registro", sucesso: `Tratamento registrado. Solicitação ${result.requestId}.` }));
  } catch (error) {
    withError(employeeRoute(employeeId, { aba: "registro" }), error);
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
    withError(employeeRoute(primaryEmployeeId, { aba: "resumo" }), error);
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
