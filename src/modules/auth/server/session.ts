import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db/prisma";
import { getOptionalPublicEnv } from "@/lib/env/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const profile = await getActiveProfile();
  if (!profile) redirect("/login?erro=perfil-inativo");
  return profile;
}

/** RH routes must never treat an employee profile as an administrative session. */
export async function requireRhStaff() {
  const profile = await requireActiveProfile();
  if (profile.role === "EMPLOYEE") redirect("/meu-ponto" as Route);
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
  const user = await requireAuthenticatedUser();
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
  if (!profile?.active || profile.role !== "EMPLOYEE" || !profile.employeeMobileAccess?.active) {
    redirect("/login?erro=acesso-funcionario-inativo");
  }
  return { profile, access: profile.employeeMobileAccess };
}
