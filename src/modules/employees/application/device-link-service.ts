import "server-only";

import { z } from "zod";
import { getPrisma } from "@/lib/db/prisma";
import { writeAuditLog, type AuditContext } from "@/modules/audit/application/log";
import { hasOverlappingDeviceLink } from "@/modules/employees/domain/relationships";
import { deviceLinkInputSchema } from "@/modules/employees/domain/validation";

const endDeviceLinkInputSchema = z.object({
  linkId: z.string().min(1, "Vínculo inválido."),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de encerramento."),
  reason: z.string().trim().min(3, "Informe o motivo para encerrar o vínculo.").max(1_000),
});

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}

export async function createEmployeeDeviceLink(employeeId: string, input: unknown, context: AuditContext) {
  const parsed = deviceLinkInputSchema.parse(input);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const employee = await transaction.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { id: true, status: true } });
    if (employee.status === "MERGED") throw new Error("Cadastros mesclados não podem receber novos vínculos com relógio.");
    const device = await transaction.device.findUniqueOrThrow({ where: { id: parsed.deviceId }, select: { id: true, active: true } });
    if (!device.active) throw new Error("Reative o dispositivo antes de criar um vínculo.");
    const existing = await transaction.employeeDeviceLink.findMany({
      where: { deviceId: parsed.deviceId, externalEmployeeNumber: parsed.externalEmployeeNumber, active: true },
      select: { id: true, validFrom: true, validUntil: true, active: true },
    });
    const candidate = { id: "candidate", validFrom: parsed.validFrom, validUntil: parsed.validUntil, active: true };
    if (hasOverlappingDeviceLink(existing.map((link) => ({ id: link.id, validFrom: link.validFrom.toISOString().slice(0, 10), validUntil: toDateKey(link.validUntil), active: link.active })), candidate)) {
      throw new Error("Já existe vínculo ativo para este EnNo, dispositivo e período informado.");
    }
    const link = await transaction.employeeDeviceLink.create({
      data: {
        employeeId,
        deviceId: parsed.deviceId,
        externalEmployeeNumber: parsed.externalEmployeeNumber,
        externalEmployeeName: parsed.externalEmployeeName ?? null,
        validFrom: dateOnly(parsed.validFrom),
        validUntil: parsed.validUntil ? dateOnly(parsed.validUntil) : null,
        active: true,
      },
      include: { device: { select: { name: true } } },
    });
    await writeAuditLog(transaction, context, {
      action: "EMPLOYEE_DEVICE_LINK_CREATED",
      entityType: "EmployeeDeviceLink",
      entityId: link.id,
      newData: {
        employeeId,
        deviceId: link.deviceId,
        deviceName: link.device.name,
        externalEmployeeNumber: link.externalEmployeeNumber,
        validFrom: link.validFrom,
        validUntil: link.validUntil,
        active: link.active,
      },
    });
    return link;
  });
}

export async function endEmployeeDeviceLink(input: { linkId: string; validUntil: string; reason: string; context: AuditContext }) {
  const parsed = endDeviceLinkInputSchema.parse(input);
  const prisma = getPrisma();
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.employeeDeviceLink.findUniqueOrThrow({ where: { id: parsed.linkId } });
    const end = dateOnly(parsed.validUntil);
    if (end < previous.validFrom) throw new Error("O encerramento não pode ser anterior ao início do vínculo.");
    const link = await transaction.employeeDeviceLink.update({ where: { id: input.linkId }, data: { validUntil: end, active: false } });
    await writeAuditLog(transaction, input.context, {
      action: "EMPLOYEE_DEVICE_LINK_ENDED",
      entityType: "EmployeeDeviceLink",
      entityId: link.id,
      oldData: { employeeId: previous.employeeId, deviceId: previous.deviceId, externalEmployeeNumber: previous.externalEmployeeNumber, validFrom: previous.validFrom, validUntil: previous.validUntil, active: previous.active },
      newData: { employeeId: link.employeeId, deviceId: link.deviceId, externalEmployeeNumber: link.externalEmployeeNumber, validFrom: link.validFrom, validUntil: link.validUntil, active: link.active },
      reason: parsed.reason,
    });
    return link;
  });
}
