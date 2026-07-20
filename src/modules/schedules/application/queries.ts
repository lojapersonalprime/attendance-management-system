import "server-only";

import { getPrisma } from "@/lib/db/prisma";

export async function listScheduleTemplates() {
  return getPrisma().scheduleTemplate.findMany({
    include: { days: { orderBy: { weekday: "asc" } }, _count: { select: { assignments: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getScheduleTemplate(id: string) {
  return getPrisma().scheduleTemplate.findUnique({
    where: { id },
    include: {
      days: { orderBy: { weekday: "asc" } },
      assignments: { take: 100, orderBy: { validFrom: "desc" }, include: { employee: { select: { id: true, fullName: true, provisional: true } } }, },
      _count: { select: { assignments: true } },
    },
  });
}
