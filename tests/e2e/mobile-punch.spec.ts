import { expect, test, type Page } from "@playwright/test";

const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL;
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD;
const enabled = Boolean(employeeEmail && employeePassword);

type GeolocationScenario = "success" | "permission-denied" | "unavailable" | "timeout" | "low-then-good";

async function mockGeolocation(page: Page, scenario: GeolocationScenario) {
  await page.addInitScript((configuredScenario) => {
    type E2EWindow = Window & { __mobilePunchLocationCalls?: number };
    const testWindow = window as E2EWindow;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback) => {
          testWindow.__mobilePunchLocationCalls = (testWindow.__mobilePunchLocationCalls ?? 0) + 1;
          const calls = testWindow.__mobilePunchLocationCalls;
          if (configuredScenario === "permission-denied") {
            failure?.({ code: 1, message: "Permission denied" } as GeolocationPositionError);
            return;
          }
          if (configuredScenario === "unavailable") {
            failure?.({ code: 2, message: "Position unavailable" } as GeolocationPositionError);
            return;
          }
          if (configuredScenario === "timeout") {
            failure?.({ code: 3, message: "Timeout" } as GeolocationPositionError);
            return;
          }
          success({
            coords: {
              latitude: -3.7319,
              longitude: -38.5267,
              accuracy: configuredScenario === "low-then-good" && calls === 1 ? 300 : 18,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });
  }, scenario);
}

async function loginAsEmployee(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(employeeEmail ?? "");
  await page.getByLabel("Senha").fill(employeePassword ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/meu-ponto/);
}

function successfulReceipt() {
  return {
    receipt: {
      id: "mobile-punch-e2e",
      registeredAt: "2026-08-20T10:03:00.000Z",
      receiptCode: "MP-E2E-RECEIPT",
      locationStatus: "INSIDE_RADIUS",
      reviewRequired: false,
    },
    duplicate: false,
  };
}

test.describe("meu-ponto no navegador móvel", () => {
  test.skip(!enabled, "Requer E2E_EMPLOYEE_EMAIL e E2E_EMPLOYEE_PASSWORD de um EmployeeMobileAccess em ambiente isolado.");
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("localização válida confirma o ponto e mostra o horário oficial da resposta", async ({ page }) => {
    await mockGeolocation(page, "success");
    const requests: Array<{ requestId: string }> = [];
    await page.route("**/api/mobile-punch", async (route) => {
      requests.push(route.request().postDataJSON() as { requestId: string });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successfulReceipt()) });
    });
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "Registrar meu ponto" }).click();
    await expect(page.getByText("Localização encontrada")).toBeVisible();
    await page.getByLabel("PIN de 6 dígitos").fill("123456");
    await page.getByRole("button", { name: "Confirmar meu ponto" }).click();
    await expect(page.getByRole("status")).toContainText("Ponto registrado!");
    await expect(page.getByRole("status")).toContainText("07:03");
    expect(requests).toHaveLength(1);
  });

  test("permissão negada mostra orientação e não envia POST", async ({ page }) => {
    await mockGeolocation(page, "permission-denied");
    let postCount = 0;
    await page.route("**/api/mobile-punch", async (route) => {
      postCount += 1;
      await route.fulfill({ status: 500, body: "unexpected request" });
    });
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "Registrar meu ponto" }).click();
    await expect(page.getByRole("alert")).toContainText("Não foi possível acessar sua localização.");
    await expect(page.getByRole("alert")).toContainText("permita o acesso à localização");
    expect(postCount).toBe(0);
  });

  test("timeout permite uma nova tentativa de localização antes de enviar o ponto", async ({ page }) => {
    await mockGeolocation(page, "timeout");
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "Registrar meu ponto" }).click();
    await expect(page.getByRole("alert")).toContainText("Não conseguimos obter sua localização a tempo.");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("alert")).toContainText("Não conseguimos obter sua localização a tempo.");
    expect(await page.evaluate(() => (window as Window & { __mobilePunchLocationCalls?: number }).__mobilePunchLocationCalls)).toBe(2);
  });

  test("falha de rede após POST confirma novamente com o mesmo UUID", async ({ page }) => {
    await mockGeolocation(page, "success");
    const requestIds: string[] = [];
    let calls = 0;
    await page.route("**/api/mobile-punch", async (route) => {
      requestIds.push((route.request().postDataJSON() as { requestId: string }).requestId);
      calls += 1;
      if (calls === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successfulReceipt()) });
    });
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "Registrar meu ponto" }).click();
    await page.getByLabel("PIN de 6 dígitos").fill("123456");
    await page.getByRole("button", { name: "Confirmar meu ponto" }).click();
    await expect(page.getByRole("alert")).toContainText("Não foi possível confirmar se o ponto foi registrado.");
    await page.getByRole("button", { name: "Confirmar novamente" }).click();
    await expect(page.getByRole("status")).toContainText("Ponto registrado!");
    expect(requestIds).toHaveLength(2);
    expect(requestIds[1]).toBe(requestIds[0]);
  });

  test("fora do raio não mostra confirmação de sucesso", async ({ page }) => {
    await mockGeolocation(page, "success");
    await page.route("**/api/mobile-punch", (route) => route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "LOCATION_BLOCKED", locationStatus: "OUTSIDE_RADIUS", error: "Não foi possível confirmar sua localização." }),
    }));
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "Registrar meu ponto" }).click();
    await page.getByLabel("PIN de 6 dígitos").fill("123456");
    await page.getByRole("button", { name: "Confirmar meu ponto" }).click();
    await expect(page.getByRole("alert")).toContainText("Você está fora da área autorizada");
    await expect(page.getByText("Ponto registrado!")).not.toBeVisible();
  });

  test("baixa precisão atualiza GPS e cria um novo UUID", async ({ page }) => {
    await mockGeolocation(page, "low-then-good");
    const requestIds: string[] = [];
    let calls = 0;
    await page.route("**/api/mobile-punch", async (route) => {
      requestIds.push((route.request().postDataJSON() as { requestId: string }).requestId);
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ code: "LOCATION_BLOCKED", locationStatus: "LOW_ACCURACY", error: "Não foi possível confirmar sua localização." }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successfulReceipt()) });
    });
    await loginAsEmployee(page);
    await page.getByRole("button", { name: "Registrar meu ponto" }).click();
    await page.getByLabel("PIN de 6 dígitos").fill("123456");
    await page.getByRole("button", { name: "Confirmar meu ponto" }).click();
    await expect(page.getByRole("alert")).toContainText("precisão suficiente");
    await page.getByRole("button", { name: "Atualizar localização" }).click();
    await expect(page.getByText("Localização encontrada")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar meu ponto" }).click();
    await expect(page.getByRole("status")).toContainText("Ponto registrado!");
    expect(requestIds).toHaveLength(2);
    expect(requestIds[1]).not.toBe(requestIds[0]);
    expect(await page.evaluate(() => (window as Window & { __mobilePunchLocationCalls?: number }).__mobilePunchLocationCalls)).toBe(2);
  });
});
