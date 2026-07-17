import { expect, test } from "@playwright/test";

const enabled = Boolean(process.env.E2E_AUTH_EMAIL && process.env.E2E_AUTH_PASSWORD);

test.describe("fluxos do MVP", () => {
  test.skip(!enabled, "Requer Supabase configurado, migration aplicada e credenciais E2E não versionadas.");

  test("login, importação, funcionários e apuração", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(process.env.E2E_AUTH_EMAIL ?? "");
    await page.getByLabel("Senha").fill(process.env.E2E_AUTH_PASSWORD ?? "");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/importacoes");
    await expect(page.getByRole("heading", { name: "Importações" })).toBeVisible();
    await page.goto("/funcionarios");
    await expect(page.getByRole("heading", { name: "Funcionários" })).toBeVisible();
    await page.goto("/jornadas");
    await expect(page.getByRole("heading", { name: "Jornadas" })).toBeVisible();
    await page.goto("/apuracao");
    await expect(page.getByRole("heading", { name: "Apuração" })).toBeVisible();
    await page.goto("/inconsistencias");
    await expect(page.getByRole("heading", { name: "Inconsistências" })).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
