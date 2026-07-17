import { z } from "zod";
import { publicEnvSchema, readPublicEnv } from "@/lib/env/schema";

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse(readPublicEnv());
}

/** Allows static interface states to render before a Supabase project is configured. */
export function getOptionalPublicEnv(): PublicEnv | undefined {
  return publicEnvSchema.safeParse(readPublicEnv()).data;
}
