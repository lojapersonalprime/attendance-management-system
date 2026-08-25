import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { toBusinessDate } from "@/lib/dates/business";
import { logicalScheduleName, selectCurrentLogicalTemplates } from "@/modules/schedules/domain/logical-template";

export async function listScheduleTemplates() {
  const today = new Date(`${toBusinessDate(new Date())}T00:00:00.000Z`);
  const templates = await getPrisma().scheduleTemplate.findMany({
    where: { active: true },
    include: { days: { orderBy: { weekday: "asc" } }, assignments: { where: { validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }] }, select: { employeeId: true } }, _count: { select: { assignments: true } } },
    orderBy: { name: "asc" },
  });
  return selectCurrentLogicalTemplates(templates).map((template) => {
    const logicalName = logicalScheduleName(template.name);
    const revisions = templates.filter((item) => logicalScheduleName(item.name).toLocaleLowerCase("pt-BR") === logicalName.toLocaleLowerCase("pt-BR"));
    return {
      ...template,
      name: logicalName,
      _count: { assignments: revisions.reduce((total, item) => total + item._count.assignments, 0) },
      currentEmployeeCount: new Set(revisions.flatMap((item) => item.assignments.map((assignment) => assignment.employeeId))).size,
    };
  }).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export async function getScheduleTemplate(id: string) {
  const template = await getPrisma().scheduleTemplate.findUnique({
    where: { id },
    include: {
      days: { orderBy: { weekday: "asc" } },
      assignments: { take: 100, orderBy: { validFrom: "desc" }, include: { employee: { select: { id: true, fullName: true, provisional: true } } }, },
      _count: { select: { assignments: true } },
    },
  });
  if (!template) return null;
  const today = new Date(`${toBusinessDate(new Date())}T00:00:00.000Z`);
  const currentEmployeeCount = await getPrisma().employeeScheduleAssignment.count({
    where: { scheduleTemplateId: id, validFrom: { lte: today }, OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
  });
  return { ...template, currentEmployeeCount };
}
