import { createClient } from "@supabase/supabase-js";
import { createScriptPrisma, loadLocalEnvironment, printSetupResult } from "./lib/runtime";

function profileNameFor(user: { email?: string; user_metadata: Record<string, unknown> }) {
  const metadataName = user.user_metadata.full_name;
  if (typeof metadataName === "string" && metadataName.trim().length >= 3) return metadataName.trim();

  const localPart = user.email?.split("@")[0]?.trim();
  return localPart && localPart.length >= 3 ? localPart : "Administrador RH";
}

async function main() {
  const local = loadLocalEnvironment();
  if (!local.exists || !local.env) {
    printSetupResult("Administrador", "pending", "preencha .env.local antes de vincular o perfil.");
    process.exitCode = 1;
    return;
  }

  const env = local.env;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    printSetupResult("Administrador", "failed", "não foi possível consultar usuários do Auth.");
    process.exitCode = 1;
    return;
  }
  if (data.users.length !== 1) {
    printSetupResult("Administrador", "pending", "é necessário selecionar explicitamente um usuário quando há zero ou mais de um usuário Auth.");
    process.exitCode = 1;
    return;
  }

  const [authUser] = data.users;
  if (!authUser?.email) {
    printSetupResult("Administrador", "failed", "o usuário Auth localizado não possui e-mail para vincular ao perfil do RH.");
    process.exitCode = 1;
    return;
  }

  const prisma = createScriptPrisma(env);
  try {
    const profile = await prisma.profile.upsert({
      where: { authUserId: authUser.id },
      create: {
        authUserId: authUser.id,
        name: profileNameFor(authUser),
        email: authUser.email,
        role: "RH_ADMIN",
        active: true,
      },
      update: {
        name: profileNameFor(authUser),
        email: authUser.email,
        role: "RH_ADMIN",
        active: true,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: profile.id,
        action: "LINK_EXISTING_AUTH_ADMIN",
        entityType: "Profile",
        entityId: profile.id,
        newData: { role: "RH_ADMIN", active: true, source: "setup:link-admin" },
        reason: "Vínculo inicial de usuário Auth existente como administrador do RH.",
      },
    });
    printSetupResult("Administrador", "ok", "usuário Auth existente vinculado a um Profile RH_ADMIN ativo.");
  } catch {
    printSetupResult("Administrador", "failed", "não foi possível criar ou atualizar o Profile administrativo.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
