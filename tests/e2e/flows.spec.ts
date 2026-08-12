import { test, expect, type Page } from "@playwright/test";

const password = process.env.E2E_PASSWORD ?? "";
const authenticatedE2E = password.length > 0;
const fullPos = Boolean(process.env.E2E_FULL_POS);
const crud = Boolean(process.env.E2E_CRUD);

async function login(page: Page, email: string) {
  await page.goto("/login");
  // Arabic-first UI: visible labels are البريد الإلكتروني / كلمة المرور.
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in|تسجيل الدخول/i }).click();
  // Cashiers land on /pos; owners/managers often / or /dashboard; pairing on /device/pair|/pos/start.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });
}

/** Pair register via POS device gate (or skip if already paired). */
async function ensureDevicePaired(page: Page) {
  await page.goto("/pos");
  await expect(page).toHaveURL(/\/pos/);

  const denied = page.getByRole("heading", { name: /نقطة البيع غير متاحة|الدخول مرفوض|مفيش صلاحية/i });
  if (await denied.isVisible({ timeout: 1_500 }).catch(() => false)) {
    throw new Error(
      "Cashier blocked from POS (missing pos_access / role_permissions). Re-seed demo RBAC."
    );
  }

  const deviceGate = page.getByRole("heading", { name: "ربط نقطة البيع" });
  const pairForm = page.getByRole("heading", { name: "اقتران جهاز الكاشير" });

  if (await deviceGate.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole("button", { name: /استخدم كاشير رئيسي/ }).click();
    await expect(deviceGate).toBeHidden({ timeout: 20_000 });
    return;
  }

  if (await pairForm.isVisible({ timeout: 1_000 }).catch(() => false)) {
    throw new Error(
      "POS asks for a pairing code with no device list — seed device «كاشير رئيسي» missing or inactive"
    );
  }
}

/** Open a cashier session when the POS shows the no-session CTA. */
async function ensureSessionOpen(page: Page) {
  // Header close control when ready is literally "إغلاق" (not "إغلاق الجلسة").
  const sessionOpenMarker = page.getByRole("button", {
    name: /^(إغلاق|إغلاق الجلسة|إغلاق الوردية)$/,
  });
  if (await sessionOpenMarker.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    return;
  }

  const openSale = page.getByRole("button", { name: /ابدأ البيع/ });
  await expect(openSale.first()).toBeVisible({ timeout: 20_000 });
  await openSale.first().click();
  await expect(page.getByText(/تم فتح الوردية|يمكنك البيع الآن/i)).toBeVisible({
    timeout: 20_000,
  });
  // Wait until server readiness refreshes past no_session (pay stays locked until then).
  await expect(sessionOpenMarker.first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("افتح جلسة كاشير الأول")).toHaveCount(0);
}

/** Add a seeded finished product and complete cash checkout. */
async function cashSellProduct(page: Page) {
  // Prefer Arabic menu demos; fall back to recipe demo SKUs also present in seed.
  const product = page.getByRole("button", { name: /قهوة تركي|Ice Cream Cup|شاي كشري/ });
  await expect(product.first()).toBeVisible({ timeout: 30_000 });
  await product.first().click();

  const cashBtn = page.getByRole("button", { name: "نقدي", exact: true });
  await expect(cashBtn).toBeEnabled({ timeout: 20_000 });
  await cashBtn.click();

  await expect(page.getByText(/تم إتمام الطلب|تم حفظ الطلب/).first()).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Flow 1 — Owner / Users", () => {
  test.skip(!authenticatedE2E, "Set E2E_PASSWORD for authenticated demo-account flows");
  test("owner can open users page", async ({ page }) => {
    await login(page, "owner@CafeFlow.local");
    await page.goto("/users");
    await expect(page).toHaveURL(/tab=users/);
    await expect(
      page.getByRole("heading", { name: /settings|الإعدادات/i })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "الفريق", exact: true })).toBeVisible();
  });
});

test.describe("P0 security", () => {
  test.skip(!authenticatedE2E, "Set E2E_PASSWORD for authenticated demo-account flows");
  test("cashier cannot open settings", async ({ page }) => {
    await login(page, "cashier1@CafeFlow.local");
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /مفيش صلاحية|access denied|الدخول مرفوض/i })
    ).toBeVisible();
  });

  test("inventory role cannot open POS", async ({ page }) => {
    await login(page, "inventory@CafeFlow.local");
    await page.goto("/pos");
    await expect(
      page.getByText(/POS not available|نقطة البيع غير متاحة|access denied|الدخول مرفوض/i)
    ).toBeVisible();
  });
});

test.describe("Flow 2 — Cashier / POS", () => {
  test.skip(
    !authenticatedE2E || !fullPos,
    "Set E2E_PASSWORD and E2E_FULL_POS=1 for full POS flow"
  );

  test("cashier checkout path", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "cashier1@CafeFlow.local");
    await ensureDevicePaired(page);
    await ensureSessionOpen(page);
    await cashSellProduct(page);
  });
});

/**
 * S10 cashier day: pair → open session → cash sell → close.
 * Requires local/staging with CafeFlow demo seed. Gate: E2E_FULL_POS=1.
 */
test.describe("S10 — Full cashier day", () => {
  test.skip(
    !authenticatedE2E || !fullPos,
    "Set E2E_PASSWORD and E2E_FULL_POS=1 for cashier-day E2E"
  );

  test("cashier day — pair, open session, cash sale, close", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "cashier1@CafeFlow.local");
    await ensureDevicePaired(page);
    await ensureSessionOpen(page);
    await cashSellProduct(page);

    // Dismiss receipt success dialog if shown.
    const continueSelling = page.getByRole("button", { name: "متابعة البيع" });
    if (await continueSelling.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueSelling.click();
    }

    // Header trigger is "إغلاق"; dialog stepper uses "إغلاق الجلسة".
    await page.getByRole("button", { name: /^(إغلاق|إغلاق الجلسة|إغلاق الوردية)$/ }).first().click();
    await expect(page.getByRole("heading", { name: "إغلاق جلسة الكاشير" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "متابعة للعدّ" }).click();

    await expect(page.getByText(/المتوقع/).first()).toBeVisible();
    // Count drawer to expected cash (zero variance).
    const expectedText = await page.locator("text=/المتوقع/").first().innerText();
    const amountMatch = expectedText.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    const actualCash = amountMatch?.[1] ?? "0";
    await page.locator("#actual-cash").fill(actualCash);

    await page.getByRole("button", { name: "إغلاق الجلسة", exact: true }).click();
    await page.getByRole("button", { name: "تأكيد الإغلاق" }).click();

    // closeSessionAction reloads the page after toast — assert we are back to no-session CTA.
    await expect(page.getByRole("button", { name: /ابدأ البيع/ }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe("Flow 3 — Inventory", () => {
  test.skip(!authenticatedE2E, "Set E2E_PASSWORD for authenticated demo-account flows");
  test("inventory user can open purchases", async ({ page }) => {
    await login(page, "inventory@CafeFlow.local");
    await page.goto("/inventory/purchases");
    await expect(
      page.getByRole("heading", { name: /purchases|المشتريات/i })
    ).toBeVisible();
  });
});

test.describe("Operational route smoke", () => {
  test.skip(!authenticatedE2E, "Set E2E_PASSWORD for authenticated demo-account flows");
  test("owner can open core catalog and order workspaces", async ({ page }) => {
    await login(page, "owner@CafeFlow.local");
    for (const [path, heading] of [
      ["/products", /المنتجات|المنيو/],
      ["/customers", /العملاء/],
      ["/online-orders", /طلبات الأونلاين|الطلبات الأونلاين/],
      ["/sales-invoices", /فواتير المبيعات/],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    }
  });
});

test.describe("CRUD regression", () => {
  test.skip(
    !authenticatedE2E || !crud,
    "Set E2E_PASSWORD and E2E_CRUD=1 to allow creating test records"
  );

  test("owner can create a validated customer", async ({ page }) => {
    await login(page, "owner@CafeFlow.local");
    await page.goto("/customers");
    await page.getByRole("button", { name: /إضافة عميل/ }).click();

    const suffix = String(Date.now()).slice(-7);
    const customerName = `عميل اختبار ${suffix}`;
    await page.getByLabel("الاسم", { exact: true }).fill(customerName);
    await page.getByLabel("الهاتف", { exact: true }).fill(`010${suffix}`);
    await page.getByRole("button", { name: "إنشاء", exact: true }).click();

    await expect(page.getByText("تم إنشاء العميل")).toBeVisible();
    await expect(page.getByText(customerName, { exact: true })).toBeVisible();
  });
});

test.describe("Public smoke", () => {
  test("login form has accessible fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "كلمة المرور", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
  });

  test("onboarding fields expose accessible names", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByLabel("اسم المؤسسة")).toBeVisible();
    await expect(page.getByLabel("العملة")).toBeVisible();
    await expect(page.getByLabel("المنطقة الزمنية")).toBeVisible();
  });

  test("auth callback rejects an external next target without a code", async ({ page }) => {
    await page.goto("/auth/callback?next=https://evil.example/steal");
    await expect(page).toHaveURL(/\/login\?error=auth$/);
    expect(new URL(page.url()).hostname).not.toBe("evil.example");
  });
});
