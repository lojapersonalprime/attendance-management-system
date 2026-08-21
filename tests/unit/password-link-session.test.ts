import { describe, expect, it, vi } from "vitest";
import { establishPasswordLinkSession, passwordLinkUrlWithoutSecrets, readPasswordLinkRedirect, type PasswordLinkAuthClient } from "@/modules/auth/domain/password-link-session";

function linkClient(overrides: Partial<PasswordLinkAuthClient["auth"]> = {}): PasswordLinkAuthClient {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "employee-auth-user" } }, error: null })),
      setSession: vi.fn(async () => ({ error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
      ...overrides,
    },
  };
}

describe("Supabase password-link session bridge", () => {
  it("persiste a sessão do fragmento de convite antes de consultar o usuário", async () => {
    const redirect = readPasswordLinkRedirect("", "#type=invite&access_token=access-token&refresh_token=refresh-token&expires_in=3600");
    const client = linkClient();

    await expect(establishPasswordLinkSession(client, redirect)).resolves.toEqual({ status: "READY", transport: "fragment" });
    expect(client.auth.setSession).toHaveBeenCalledWith({ access_token: "access-token", refresh_token: "refresh-token" });
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(passwordLinkUrlWithoutSecrets("/auth/definir-senha", "", "#type=invite&access_token=access-token&refresh_token=refresh-token")).toBe("/auth/definir-senha");
    expect(passwordLinkUrlWithoutSecrets("/auth/definir-senha", "?keep=value&code=one-time", "#access_token=access-token&refresh_token=refresh-token&tab=security")).toBe("/auth/definir-senha?keep=value#tab=security");
  });

  it("troca code por sessão antes de encaminhar para a definição de senha", async () => {
    const redirect = readPasswordLinkRedirect("?code=recovery-or-supported-invite-code", "");
    const client = linkClient();

    await expect(establishPasswordLinkSession(client, redirect)).resolves.toEqual({ status: "READY", transport: "code" });
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith("recovery-or-supported-invite-code");
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("aceita token_hash somente para convite ou recovery", async () => {
    const redirect = readPasswordLinkRedirect("?token_hash=one-time-hash&type=invite", "");
    const client = linkClient();

    await expect(establishPasswordLinkSession(client, redirect)).resolves.toEqual({ status: "READY", transport: "token_hash" });
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time-hash", type: "invite" });
  });

  it("trata convite expirado sem consultar ou aceitar uma sessão existente", async () => {
    const redirect = readPasswordLinkRedirect("", "#type=invite&access_token=expired&refresh_token=expired");
    const getUser = vi.fn(async () => ({ data: { user: { id: "unrelated-session" } }, error: null }));
    const client = linkClient({ getUser, setSession: vi.fn(async () => ({ error: { status: 400, code: "otp_expired" } })) });

    await expect(establishPasswordLinkSession(client, redirect)).resolves.toEqual({ status: "ERROR", code: "INVITE_INVALID_OR_EXPIRED", transport: "fragment" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("retorna erro controlado para link sem parâmetros e sem sessão", async () => {
    const client = linkClient({ getUser: vi.fn(async () => ({ data: { user: null }, error: null })) });

    await expect(establishPasswordLinkSession(client, readPasswordLinkRedirect("", ""))).resolves.toEqual({ status: "ERROR", code: "INVITE_MISSING_PARAMETERS", transport: "none" });
  });

  it("classifica uma rejeição de Redirect URL sem registrar o link", async () => {
    const redirect = readPasswordLinkRedirect("?error=redirect_uri_mismatch&error_description=not-allowed", "");

    await expect(establishPasswordLinkSession(linkClient(), redirect)).resolves.toEqual({ status: "ERROR", code: "INVITE_REDIRECT_MISCONFIGURED", transport: "none" });
  });
});
