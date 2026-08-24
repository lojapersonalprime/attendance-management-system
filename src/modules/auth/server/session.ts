import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db/prisma";
import { getOptionalPublicEnv } from "@/lib/env/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { employeePortalAccessIssue, hasActiveProfile, hasEmployeePortalAccess, profileAvailabilityIssue, type EmployeePortalAccessIssue, type ProfileAvailabilityIssue } from "@/modules/auth/domain/employee-portal-access";

type AccessUnavailableReason = "perfil-ausente" | "perfil-inativo" | "acesso-ausente" | "acesso-inativo";

function logAuthRedirect(code: "AUTH_REDIRECT_DASHBOARD_EMPLOYEE" | "PROFILE_MISSING" | "PROFILE_INACTIVE" | "EMPLOYEE_ACCESS_MISSING" | "EMPLOYEE_ACCESS_INACTIVE") {
  console.warn("[auth-redirect]", { code });
}

function redirectToUnavailable(reason: AccessUnavailableReason, code: "PROFILE_MISSING" | "PROFILE_INACTIVE" | "EMPLOYEE_ACCESS_MISSING" | "EMPLOYEE_ACCESS_INACTIVE"): never {
  logAuthRedirect(code);
  redirect(`/acesso-indisponivel?motivo=${reason}` as Route);
}

function redirectForProfileIssue(issue: ProfileAvailabilityIssue): never {
  return issue === "PROFILE_MISSING"
    ? redirectToUnavailable("perfil-ausente", issue)
    : redirectToUnavailable("perfil-inativo", issue);
}

function redirectForEmployeePortalIssue(issue: Exclude<EmployeePortalAccessIssue, "ROLE_NOT_EMPLOYEE">): never {
  switch (issue) {
    case "PROFILE_MISSING": return redirectToUnavailable("perfil-ausente", issue);
    case "PROFILE_INACTIVE": return redirectToUnavailable("perfil-inativo", issue);
    case "EMPLOYEE_ACCESS_MISSING": return redirectToUnavailable("acesso-ausente", issue);
    case "EMPLOYEE_ACCESS_INACTIVE": return redirectToUnavailable("acesso-inativo", issue);
  }
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

export async function getAuthenticatedUser() {
  if (!getOptionalPublicEnv()) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

export async function getActiveProfile() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const profile = await getPrisma().profile.findUnique({ where: { authUserId: user.id } });
  return profile?.active ? profile : null;
}

export async function requireActiveProfile() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrisma().profile.findUnique({ where: { authUserId: user.id } });
  const issue = profileAvailabilityIssue(profile);
  if (issue) redirectForProfileIssue(issue);
  if (!hasActiveProfile(profile)) throw new Error("O perfil ativo não pôde ser determinado.");
  return profile;
}

/** RH routes must never treat an employee profile as an administrative session. */
export async function requireRhStaff() {
  const profile = await requireActiveProfile();
  if (profile.role === "EMPLOYEE") {
    logAuthRedirect("AUTH_REDIRECT_DASHBOARD_EMPLOYEE");
    redirect("/meu-ponto" as Route);
  }
  return profile;
}

export async function requireRhAdmin() {
  const profile = await requireRhStaff();
  if (profile.role !== "RH_ADMIN") {
    throw new Error("Esta ação exige permissão de administrador de RH.");
  }
  return profile;
}

export async function requireEmployeeMobileAccess() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrisma().profile.findUnique({
    where: { authUserId: user.id },
    include: {
      employeeMobileAccess: {
        include: {
          employee: { include: { unit: true } },
          allowedUnit: true,
        },
      },
    },
  });
  const issue = employeePortalAccessIssue(profile);
  if (issue === "ROLE_NOT_EMPLOYEE") redirect("/dashboard" as Route);
  if (issue) {
    redirectForEmployeePortalIssue(issue);
  }
  if (!hasEmployeePortalAccess(profile)) throw new Error("O acesso mobile ativo não pôde ser determinado.");
  return { profile, access: profile.employeeMobileAccess };
}
