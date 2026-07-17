import "server-only";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PrivateStorage } from "@/lib/storage/private-storage";

export class StorageProviderError extends Error {
  constructor(
    message: string,
    readonly operation: "upload" | "exists" | "remove",
    readonly provider: { code?: string; message?: string; statusCode?: string; hint?: string },
  ) {
    super(message);
    this.name = "StorageProviderError";
  }
}

export class SupabasePrivateStorage implements PrivateStorage {
  async upload(path: string, content: Buffer, contentType: string): Promise<void> {
    const env = getServerEnv();
    const { error } = await createSupabaseAdminClient().storage.from(env.SUPABASE_STORAGE_BUCKET).upload(path, content, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw new StorageProviderError("Não foi possível preservar o arquivo original no armazenamento privado.", "upload", {
        message: error.message,
        statusCode: error.statusCode,
      });
    }
  }

  async exists(path: string): Promise<boolean> {
    const env = getServerEnv();
    const parts = path.split("/");
    const filename = parts.pop();
    const folder = parts.join("/");
    if (!filename) return false;
    const { data, error } = await createSupabaseAdminClient().storage.from(env.SUPABASE_STORAGE_BUCKET).list(folder, {
      search: filename,
      limit: 1,
    });
    if (error) {
      throw new StorageProviderError("Não foi possível verificar o arquivo no armazenamento privado.", "exists", {
        message: error.message,
        statusCode: error.statusCode,
      });
    }
    return data.some((object) => object.name === filename);
  }

  async remove(path: string): Promise<void> {
    const env = getServerEnv();
    const { error } = await createSupabaseAdminClient().storage.from(env.SUPABASE_STORAGE_BUCKET).remove([path]);
    if (error) {
      throw new StorageProviderError("Não foi possível remover o arquivo do armazenamento privado após falha.", "remove", {
        message: error.message,
        statusCode: error.statusCode,
      });
    }
  }
}
