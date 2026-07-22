import type { Route } from "next";

type QueryValue = string | number | boolean | undefined;

export const employeesRoute = "/funcionarios" satisfies Route;
export const newEmployeeRoute = "/funcionarios/novo" satisfies Route;
export const schedulesRoute = "/jornadas" satisfies Route;
export const newScheduleRoute = "/jornadas/nova" satisfies Route;
export const settingsRoute = "/configuracoes" satisfies Route;
export const attendanceRoute = "/apuracao" satisfies Route;

function withQuery(path: string, query?: Record<string, QueryValue>): Route {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return `${path}${search.size > 0 ? `?${search.toString()}` : ""}` as Route;
}

export function employeeRoute(employeeId: string, query?: Record<string, QueryValue>): Route {
  return withQuery(`/funcionarios/${encodeURIComponent(employeeId)}`, query);
}

export function scheduleRoute(scheduleId: string, query?: Record<string, QueryValue>): Route {
  return withQuery(`/jornadas/${encodeURIComponent(scheduleId)}`, query);
}

export function attendanceSummaryRoute(summaryId: string, query?: Record<string, QueryValue>): Route {
  return withQuery(`/apuracao/${encodeURIComponent(summaryId)}`, query);
}

export function employeesRouteWithQuery(query?: Record<string, QueryValue>): Route {
  return withQuery(employeesRoute, query);
}
