import { expect, test } from "@playwright/test";

const enabled = Boolean(process.env.E2E_AUTH_EMAIL && process.env.E2E_AUTH_PASSWORD);
const writeEnabled = enabled && process.env.E2E_WRITE_ENABLED === "true" && process.env.E2E_ISOLATED === "true";

test.describe("fluxos autenticados de leitura do MVP", () => {
  test.skip(!enabled, "Requer Supabase configurado, migration aplicada e credenciais E2E não versionadas.");

  test("login, navegação de funcionários, jornadas e logout", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_AUTH_EMAIL ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/importacoes");
    await expect(page.getByRole("heading", { name: "Importar ponto" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Arraste o arquivo do relógio para cá" })).toBeVisible();
    await page.goto("/funcionarios");
    await expect(page.getByRole("heading", { name: "Funcionários" })).toBeVisible();
    await expect(page.getByLabel("Cadastro")).toBeVisible();
    await page.goto("/funcionarios/novo");
    await expect(page.getByRole("heading", { name: "Novo funcionário" })).toBeVisible();
    await page.goto("/jornadas");
    await expect(page.getByRole("heading", { name: "Modelos de horário" })).toBeVisible();
    await page.goto("/configuracoes");
    await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
    await page.getByRole("link", { name: "Gerenciar" }).first().click();
    await expect(page.getByRole("heading", { name: "Unidades" })).toBeVisible();
    await page.goto("/apuracao");
    await expect(page.getByRole("heading", { name: "Registro do ponto" })).toBeVisible();
    await page.goto("/inconsistencias");
    await expect(page.getByRole("heading", { name: "Pendências" })).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

});

test.describe("fluxos autenticados de escrita do MVP", () => {
  test.skip(!writeEnabled, "Requer ambiente isolado explicitamente marcado com E2E_ISOLATED=true e E2E_WRITE_ENABLED=true.");

  test("fluxo sintético de cadastro, jornada, tag e histórico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_AUTH_EMAIL ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/configuracoes");
    await page.goto("/configuracoes/estrutura?aba=TAG");
    await expect(page.getByRole("heading", { name: "Tags" })).toBeVisible();
    await page.goto("/jornadas/nova");
    await expect(page.getByRole("heading", { name: "Novo modelo de horário" })).toBeVisible();
    await page.goto("/funcionarios/novo");
    await expect(page.getByRole("button", { name: "Criar funcionário" })).toBeVisible();
  });
});
