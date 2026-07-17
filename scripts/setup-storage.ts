import { createClient } from "@supabase/supabase-js";
import { loadLocalEnvironment, printSetupResult } from "./lib/runtime";

async function main() {
  const local = loadLocalEnvironment();
  if (!local.exists || !local.env) {
    printSetupResult("Configuração", "pending", "preencha os valores obrigatórios de .env.local antes de configurar o Storage.");
    process.exitCode = 1;
    return;
  }

  const env = local.env;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: buckets, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    printSetupResult("Bucket", "failed", "não foi possível consultar o Storage. Revise a service role.");
    process.exitCode = 1;
    return;
  }

  const existing = buckets.find((bucket) => bucket.name === env.SUPABASE_STORAGE_BUCKET);
  if (!existing) {
    const { error } = await admin.storage.createBucket(env.SUPABASE_STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: "10485760",
      allowedMimeTypes: ["text/plain"],
    });
    if (error) {
      printSetupResult("Bucket", "failed", "não foi possível criar o bucket. Revise as permissões do projeto.");
      process.exitCode = 1;
      return;
    }
    printSetupResult("Bucket", "ok", "criado como privado com limite inicial de 10 MB.");
    return;
  }

  if (existing.public) {
    const { error } = await admin.storage.updateBucket(env.SUPABASE_STORAGE_BUCKET, { public: false });
    if (error) {
      printSetupResult("Bucket", "failed", "o bucket existe, mas não foi possível torná-lo privado.");
      process.exitCode = 1;
      return;
    }
    printSetupResult("Bucket", "ok", "existente e ajustado para privado.");
    return;
  }

  printSetupResult("Bucket", "ok", "já existe e permanece privado.");
}

void main();
