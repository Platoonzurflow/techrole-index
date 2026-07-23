import { expect, test } from "@playwright/test";

test("a new user can complete the sandbox payment without a real charge", async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.goto("/register");
  await page.getByLabel("Имя").fill("Тест оплаты");
  await page.getByLabel("Email").fill(`payment-${unique}@playwright.techrole.dev`);
  await page.getByLabel("Пароль").fill("SandboxPayment-Only1!");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.locator(".account-access")).toContainText("Базовый доступ");
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
});
