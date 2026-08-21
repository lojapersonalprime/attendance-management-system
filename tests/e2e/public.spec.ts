import { expect, test } from "@playwright/test";

test.describe("rotas públicas e proteção de sessão", () => {
  test("carrega o login sem erros de console", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("/_next/webpack-hmr")) {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Acesso Personal Prime" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Esqueci minha senha" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("permite solicitar recuperação sem expor se o e-mail possui conta", async ({ page }) => {
    await page.goto("/login?recuperar=1");
    await expect(page.getByRole("button", { name: "Enviar instruções" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("explica um link de senha inválido sem deixar a pessoa em tela vazia", async ({ page }) => {
    await page.goto("/auth/definir-senha");
    await expect(page.getByRole("heading", { name: "Defina sua senha" })).toBeVisible();
    await expect(page.getByText("Este link não é mais válido.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao login e solicitar recuperação" })).toBeVisible();
  });

  test("redireciona uma rota protegida para o login sem sessão", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
