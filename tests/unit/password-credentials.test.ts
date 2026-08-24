import { describe, expect, it, vi } from "vitest";
import { hasAuthorizedPasswordSession, minimumSupabasePasswordLength, passwordRecoverySchema, passwordUpdateSchema, requestPasswordRecovery, type PasswordAuthClient, updateAuthorizedUserPassword } from "@/modules/auth/domain/password-credentials";

function authClient(overrides: Partial<PasswordAuthClient["auth"]> = {}): PasswordAuthClient {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-user" } }, error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      ...overrides,
    },
  };
}

describe("password credentials through Supabase Auth", () => {
  it("valida senha e confirmação antes de chamar o Supabase", () => {
    expect(passwordUpdateSchema.parse({ password: "123456", confirmPassword: "123456" })).toEqual({ password: "123456", confirmPassword: "123456" });
    expect(() => passwordUpdateSchema.parse({ password: "12345", confirmPassword: "12345" })).toThrow(`pelo menos ${minimumSupabasePasswordLength}`);
    expect(() => passwordUpdateSchema.parse({ password: "123456", confirmPassword: "654321" })).toThrow("As senhas informadas não conferem");
  });

  it("atualiza a senha somente com uma sessão Supabase autorizada", async () => {
    const client = authClient();
    expect(await hasAuthorizedPasswordSession(client)).toBe(true);
    await expect(updateAuthorizedUserPassword(client, "senha-nova")).resolves.toEqual({ status: "SUCCESS" });
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: "senha-nova" });
  });

  it("não chama updateUser quando o link não autoriza uma sessão", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    const client = authClient({ getUser: vi.fn(async () => ({ data: { user: null }, error: null })), updateUser });
    await expect(updateAuthorizedUserPassword(client, "senha-nova")).resolves.toEqual({ status: "PASSWORD_SESSION_REQUIRED" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("mantém o erro de atualização genérico quando o Supabase rejeita a nova senha", async () => {
    const client = authClient({ updateUser: vi.fn(async () => ({ error: new Error("policy") })) });
    await expect(updateAuthorizedUserPassword(client, "senha-nova")).resolves.toEqual({ status: "FAILED" });
  });

  it("solicita recuperação no redirect de definição de senha sem revelar a existência do e-mail", async () => {
    expect(passwordRecoverySchema.parse({ email: "bruna@empresa.com" })).toEqual({ email: "bruna@empresa.com" });
    const client = authClient();
    await expect(requestPasswordRecovery(client, "bruna@empresa.com", "https://ponto.personalprime.com.br/auth/definir-senha")).resolves.toEqual({ status: "REQUESTED" });
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith("bruna@empresa.com", { redirectTo: "https://ponto.personalprime.com.br/auth/definir-senha" });
  });
});
