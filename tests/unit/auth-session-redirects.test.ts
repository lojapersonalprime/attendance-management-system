import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findProfile: vi.fn(),
  getOptionalPublicEnv: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/env/public", () => ({ getOptionalPublicEnv: mocks.getOptionalPublicEnv }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: vi.fn(() => ({ profile: { findUnique: mocks.findProfile } })) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requireEmployeeMobileAccess, requireRhStaff } from "@/modules/auth/server/session";

function profile(overrides: Record<string, unknown> = {}) {
  return { id: "profile", authUserId: "auth-user", active: true, role: "EMPLOYEE", employeeMobileAccess: { active: true }, ...overrides };
}

async function expectRedirect(action: () => Promise<unknown>, path: string) {
  await expect(action()).rejects.toThrow(`redirect:${path}`);
  expect(mocks.redirect).toHaveBeenLastCalledWith(path);
}

describe("server session redirects", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.getOptionalPublicEnv.mockReturnValue({});
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null });
    mocks.findProfile.mockResolvedValue(profile());
    mocks.redirect.mockImplementation((path: string) => { throw new Error(`redirect:${path}`); });
  });

  it("encaminha EMPLOYEE válido do dashboard ao portal sem passar pelo login", async () => {
    await expectRedirect(requireRhStaff, "/meu-ponto");
    await expect(requireEmployeeMobileAccess()).resolves.toMatchObject({ profile: { role: "EMPLOYEE" }, access: { active: true } });
    expect(mocks.redirect).not.toHaveBeenCalledWith("/login");
  });

  it("mantém RH no dashboard", async () => {
    mocks.findProfile.mockResolvedValue(profile({ role: "RH_ADMIN", employeeMobileAccess: null }));

    await expect(requireRhStaff()).resolves.toMatchObject({ role: "RH_ADMIN" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("leva EMPLOYEE sem acesso mobile para estado estável, não para login", async () => {
    mocks.findProfile.mockResolvedValue(profile({ employeeMobileAccess: null }));

    await expectRedirect(requireEmployeeMobileAccess, "/acesso-indisponivel?motivo=acesso-ausente");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/login");
  });

  it("leva acesso mobile inativo para estado estável, não para login", async () => {
    mocks.findProfile.mockResolvedValue(profile({ employeeMobileAccess: { active: false } }));

    await expectRedirect(requireEmployeeMobileAccess, "/acesso-indisponivel?motivo=acesso-inativo");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/login");
  });

  it("leva perfil ausente ou inativo para estado estável", async () => {
    mocks.findProfile.mockResolvedValueOnce(null);
    await expectRedirect(requireRhStaff, "/acesso-indisponivel?motivo=perfil-ausente");

    mocks.findProfile.mockResolvedValueOnce(profile({ active: false }));
    await expectRedirect(requireRhStaff, "/acesso-indisponivel?motivo=perfil-inativo");
  });

  it("manda ao login somente quando não existe sessão Supabase", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expectRedirect(requireEmployeeMobileAccess, "/login");
  });
});
