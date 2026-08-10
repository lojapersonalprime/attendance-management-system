import { z } from "zod";

function hasSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function hasPostgresProtocol(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

const supabaseUrlSchema = z
  .string()
  .url("Informe uma URL válida do projeto Supabase.")
  .refine(hasSupabaseUrl, "A URL deve apontar para um projeto hospedado no Supabase.");

const postgresUrlSchema = z
  .string()
  .url("Informe uma URL de conexão PostgreSQL válida.")
  .refine(hasPostgresProtocol, "A conexão deve usar o protocolo postgres:// ou postgresql://.");

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Informe a chave pública anônima do Supabase."),
  NEXT_PUBLIC_SITE_URL: z.string().url("Informe uma URL pública válida quando configurada.").optional(),
});

export const serverEnvSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
  DIRECT_URL: postgresUrlSchema,
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "Informe a chave service role do Supabase apenas no ambiente do servidor."),
  SUPABASE_STORAGE_BUCKET: z
    .string()
    .min(3, "O bucket precisa ter pelo menos 3 caracteres.")
    .max(63, "O bucket precisa ter no máximo 63 caracteres."),
});

export const runtimeEnvSchema = publicEnvSchema.merge(serverEnvSchema);

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function readPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined,
  };
}

export function readServerEnv() {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
  };
}

export function readRuntimeEnv() {
  return {
    ...readPublicEnv(),
    ...readServerEnv(),
  };
}
