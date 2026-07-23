import { expect, test } from "@playwright/test";

test("a new user can complete the sandbox payment without a real charge", async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Тест оплаты");
  await page.getByLabel("Email").fill(`payment-${unique}@playwright.techrole.dev`);
  await page.getByLabel("Пароль").fill("SandboxPayment-Only1!");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(page).toHaveURL(/\/account$/);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".account-access")).toContainText("Базовый доступ");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Premium-дашборд" })).toBeVisible();
  await expect(page.getByText("Дашборд доступен пользователям Premium")).toBeVisible();
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { level: 1, name: "Уведомления о рынке" })).toBeVisible();
  await expect(page.getByText("Уведомления доступны в Premium")).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByText("Подключён безопасный тестовый режим", { exact: false })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/account");
  await expect(page.locator("html")).toHaveClass(/dark/);
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Тестовая оплата/ }).click();

  await expect(page).toHaveURL(/\/payments\/demo\/[a-f0-9-]+$/);
  await expect(page.getByRole("heading", { name: "Тестовая платёжная страница" })).toBeVisible();
  await page.getByRole("button", { name: "Имитировать успешную оплату" }).click();

  await expect(page).toHaveURL(/\/payments\/success\?order_id=/);
  await expect(page.getByRole("heading", { name: "Оплата прошла успешно" })).toBeVisible();
  await expect(page.getByText("Это тестовый платёж: реальные деньги не списывались.")).toBeVisible();
  await page.getByRole("link", { name: "Личный кабинет" }).click();
  await expect(page.locator(".account-access")).toContainText("Premium активен");
  await expect(page.getByRole("heading", { name: "Платежи и возвраты" })).toBeVisible();
  await expect(page.getByText("Оплачен · тест")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Профессии в фокусе" })).toBeVisible();
  await page.goto("/alerts");
  await expect(page.getByRole("heading", { name: "Следить за показателем" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить правило" })).toBeVisible();
});
