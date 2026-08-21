import { z } from "zod";

/** Supabase accepts passwords with at least six characters by default. The Auth
 * service remains the authority for any stricter policy configured per project. */
export const minimumSupabasePasswordLength = 6;

export const passwordUpdateSchema = z.object({
  password: z.string().min(minimumSupabasePasswordLength, `Use pelo menos ${minimumSupabasePasswordLength} caracteres.`),
  confirmPassword: z.string().min(1, "Confirme a nova senha."),
}).refine((value) => value.password === value.confirmPassword, {
  message: "As senhas informadas não conferem.",
  path: ["confirmPassword"],
});

export const passwordRecoverySchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

export type PasswordUpdateValues = z.infer<typeof passwordUpdateSchema>;
export type PasswordRecoveryValues = z.infer<typeof passwordRecoverySchema>;

type AuthUserResponse = {
  data: { user: unknown | null };
  error: unknown | null;
};

type AuthErrorResponse = {
  error: unknown | null;
};

/** Narrow client contract keeps browser authentication calls straightforward to test. */
export type PasswordAuthClient = {
  auth: {
    getUser: () => Promise<AuthUserResponse>;
    updateUser: (attributes: { password: string }) => Promise<AuthErrorResponse>;
    resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<AuthErrorResponse>;
  };
};

export async function hasAuthorizedPasswordSession(client: PasswordAuthClient) {
  const result = await client.auth.getUser();
  return !result.error && Boolean(result.data.user);
}

export async function updateAuthorizedUserPassword(client: PasswordAuthClient, password: string) {
  if (!await hasAuthorizedPasswordSession(client)) return { status: "PASSWORD_SESSION_REQUIRED" as const };
  const result = await client.auth.updateUser({ password });
  return result.error ? { status: "FAILED" as const } : { status: "SUCCESS" as const };
}

export async function requestPasswordRecovery(client: PasswordAuthClient, email: string, redirectTo: string) {
  const result = await client.auth.resetPasswordForEmail(email, { redirectTo });
  return result.error ? { status: "FAILED" as const } : { status: "REQUESTED" as const };
}
