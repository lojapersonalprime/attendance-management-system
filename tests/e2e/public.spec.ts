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
    await expect(page.locator('img[src*="personal-prime-symbol-orange"]')).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("permite solicitar recuperação sem expor se o e-mail possui conta", async ({ page }) => {
    await page.goto("/login?recuperar=1");
    await expect(page.getByRole("button", { name: "Enviar instruções" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });

  test("preserva a marca e não cria rolagem horizontal no acesso por celular", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await expect(page.locator('img[src*="personal-prime-symbol-orange"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Acesso Personal Prime" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

  test("mantém assets da marca públicos e o dashboard protegido sem sessão", async ({ page }) => {
    const asset = await page.request.get("/brand/personal-prime-symbol-orange.png", { failOnStatusCode: false });
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/png");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
