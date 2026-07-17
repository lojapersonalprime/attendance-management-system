import { createClient } from "@supabase/supabase-js";
import {
  createScriptPrisma,
  failWithoutSensitiveDetails,
  loadLocalEnvironment,
  printSetupResult,
} from "./lib/runtime";

async function main() {
  const local = loadLocalEnvironment();

  if (!local.exists) {
    printSetupResult(".env.local", "pending", "arquivo não encontrado.");
    process.exitCode = 1;
    return;
  }

  if (!local.env) {
    printSetupResult("Variáveis obrigatórias", "pending", `preencha: ${local.issues.join(", ")}.`);
    process.exitCode = 1;
    return;
  }

  const env = local.env;
  printSetupResult("Variáveis obrigatórias", "ok", "configuradas.");
  printSetupResult("URL do Supabase", "ok", "formato válido.");

  const prisma = createScriptPrisma(env);
  let databaseAvailable = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseAvailable = true;
    printSetupResult("Banco PostgreSQL", "ok", "conectado.");
    printSetupResult("Prisma Client", "ok", "consulta executada.");
  } catch {
    failWithoutSensitiveDetails("Banco PostgreSQL");
    process.exitCode = 1;
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: adminError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (adminError) {
    failWithoutSensitiveDetails("Acesso administrativo ao Supabase");
    process.exitCode = 1;
  } else {
    printSetupResult("Acesso administrativo ao Supabase", "ok", "validado.");
  }

  const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
  if (bucketError) {
    failWithoutSensitiveDetails("Bucket de importações");
    process.exitCode = 1;
  } else {
    const bucket = buckets.find((item) => item.name === env.SUPABASE_STORAGE_BUCKET);
    if (bucket?.public) {
      printSetupResult("Bucket de importações", "failed", "encontrado, mas está público.");
      process.exitCode = 1;
    } else if (bucket) {
      printSetupResult("Bucket de importações", "ok", "encontrado e privado.");
    } else {
      printSetupResult("Bucket de importações", "pending", "ainda não foi criado.");
      process.exitCode = 1;
    }
  }

  if (databaseAvailable) {
    try {
      const [migration] = await prisma.$queryRaw<Array<{ migrationTable: string | null }>>`
        SELECT to_regclass('public."_prisma_migrations"')::text AS "migrationTable"
      `;
      if (migration?.migrationTable) {
        printSetupResult("Migration", "ok", "histórico de migrations encontrado.");
      } else {
        printSetupResult("Migration", "pending", "histórico não encontrado. Execute npm run db:migrate.");
        process.exitCode = 1;
      }

      const profiles = await prisma.profile.findMany({
        where: { role: "RH_ADMIN", active: true },
        select: { authUserId: true },
        take: 100,
      });
      const profilesWithoutAuth = await Promise.all(
        profiles.map(async (profile) => {
          const { data, error } = await admin.auth.admin.getUserById(profile.authUserId);
          return !data.user || Boolean(error);
        }),
      );

      if (profiles.length === 0) {
        printSetupResult("Usuário RH_ADMIN", "pending", "nenhum perfil administrativo ativo encontrado.");
        process.exitCode = 1;
      } else if (profilesWithoutAuth.some(Boolean)) {
        printSetupResult("Auth e Profile", "failed", "há perfil administrativo sem usuário Auth correspondente.");
        process.exitCode = 1;
      } else {
        printSetupResult("Usuário RH_ADMIN", "ok", "perfil administrativo ativo encontrado.");
        printSetupResult("Auth e Profile", "ok", "perfis administrativos coerentes.");
      }
    } catch {
      printSetupResult("Tabelas da aplicação", "pending", "não estão disponíveis. Execute npm run db:migrate.");
      process.exitCode = 1;
    }
  }

  await prisma.$disconnect();
}

void main();
