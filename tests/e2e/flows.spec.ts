import { test, expect } from "@playwright/test";

const password = process.env.E2E_PASSWORD ?? "demo1234";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/($|\?|pos\/start|device\/pair)/);
}

test.describe("Flow 1 — Owner / Users", () => {
  test("owner can open users page", async ({ page }) => {
    await login(page, "owner@SweetFlow.local");
    await page.goto("/users");
    await expect(page).toHaveURL(/tab=users/);
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /team/i })).toBeVisible();
  });
});

test.describe("P0 security", () => {
  test("cashier cannot open settings", async ({ page }) => {
    await login(page, "cashier1@SweetFlow.local");
    await page.goto("/settings");
    await expect(page.getByText(/access denied/i)).toBeVisible();
  });

  test("inventory role cannot open POS", async ({ page }) => {
    await login(page, "inventory@SweetFlow.local");
    await page.goto("/pos");
    await expect(page.getByText(/POS not available/i)).toBeVisible();
  });
});

test.describe("Flow 2 — Cashier / POS", () => {
  test.skip(!process.env.E2E_FULL_POS, "Set E2E_FULL_POS=1 for full POS flow");

  test("cashier checkout path", async ({ page }) => {
    await login(page, "cashier1@SweetFlow.local");
    await page.goto("/device/pair");
    await page.goto("/pos");
    await expect(page.getByText(/cart/i)).toBeVisible();
  });
});

test.describe("Flow 3 — Inventory", () => {
  test("inventory user can open purchases", async ({ page }) => {
    await login(page, "inventory@SweetFlow.local");
    await page.goto("/inventory/purchases");
    await expect(page.getByRole("heading", { name: /purchases/i })).toBeVisible();
  });
});

test.describe("Flow 4 — Monthly closing", () => {
  test("owner can open monthly closing", async ({ page }) => {
    await login(page, "owner@SweetFlow.local");
    await page.goto("/monthly-closing");
    await expect(page.getByRole("heading", { name: /monthly closing/i })).toBeVisible();
  });
});

test.describe("Flow 5 — Public QR menu", () => {
  test("public menu loads without auth", async ({ page }) => {
    const token = process.env.E2E_MENU_TOKEN;
    test.skip(!token, "Set E2E_MENU_TOKEN from Settings QR link");
    await page.goto(`/menu/${token}`);
    await expect(page.getByText(/order|menu/i).first()).toBeVisible();
  });
});
