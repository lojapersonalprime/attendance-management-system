import { describe, expect, it } from "vitest";
import { buildPublicAppRedirectUrl, getEmployeeInviteRedirectUrl, resolvePublicAppUrl } from "@/lib/env/public-app-url";

describe("public app URL for employee invitations", () => {
  it("usa localhost somente no desenvolvimento local", () => {
    expect(resolvePublicAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });

  it("usa a URL do deployment no Preview Vercel", () => {
    const environment = { NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "ponto-git-mobile-acesso-personal-prime.vercel.app" };
    expect(resolvePublicAppUrl(environment)).toBe("https://ponto-git-mobile-acesso-personal-prime.vercel.app");
    expect(getEmployeeInviteRedirectUrl(environment)).toBe("https://ponto-git-mobile-acesso-personal-prime.vercel.app/auth/callback");
    expect(getEmployeeInviteRedirectUrl(environment)).not.toContain("localhost");
  });

  it("aceita a variável pública da Vercel quando a variável de servidor não estiver exposta", () => {
    expect(resolvePublicAppUrl({ NODE_ENV: "production", VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_URL: "ponto-git-mobile-acesso-personal-prime.vercel.app" })).toBe("https://ponto-git-mobile-acesso-personal-prime.vercel.app");
  });

  it("prioriza a URL oficial explicitamente configurada em Production", () => {
    expect(resolvePublicAppUrl({ NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "ponto.vercel.app", NEXT_PUBLIC_SITE_URL: "https://ponto.personalprime.com.br" })).toBe("https://ponto.personalprime.com.br");
    expect(() => resolvePublicAppUrl({ NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_URL: "ponto.vercel.app" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("mantém o redirect na origem autorizada e recusa URL de deployment inválida", () => {
    const environment = { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://ponto.personalprime.com.br" };
    expect(buildPublicAppRedirectUrl("/auth/callback", environment)).toBe("https://ponto.personalprime.com.br/auth/callback");
    expect(() => buildPublicAppRedirectUrl("//externo.example" as `/${string}`, environment)).toThrow(/origem pública autorizada/);
    expect(() => buildPublicAppRedirectUrl("/\\externo.example" as `/${string}`, environment)).toThrow(/origem pública autorizada/);
    expect(() => resolvePublicAppUrl({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_URL: "externo.example" })).toThrow(/deployment Vercel válido/);
  });
});
