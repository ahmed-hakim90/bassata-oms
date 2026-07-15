import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExpense, type CreateExpenseInput } from "@/modules/expenses/services/expense.service";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as settingsService from "@/modules/system/services/settings.service";
import { assertPeriodOpen, PeriodClosedError } from "@/lib/services/period-lock.service";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { AppUser, Expense } from "@/lib/types";

vi.mock("@/lib/repositories/expense.repository");
vi.mock("@/lib/repositories/expense-category.repository");
vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/session.repository");
vi.mock("@/lib/repositories/warehouse.repository");
vi.mock("@/modules/system/services/settings.service");
vi.mock("@/lib/services/period-lock.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/period-lock.service")>();
  return {
    ...actual,
    assertPeriodOpen: vi.fn(),
  };
});
vi.mock("@/lib/services/inventory-movement.service", () => ({ adjustStock: vi.fn() }));
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/organization.repository", () => ({ getOrgId: vi.fn() }));

const cashier: AppUser = {
  id: "cashier-1",
  org_id: "org-1",
  auth_user_id: "auth-1",
  name: "Cashier",
  email: "cashier@test.com",
  role: "cashier",
  is_active: true,
  store_ids: ["store-1"],
};

const baseInput: CreateExpenseInput = {
  store_id: "store-1",
  session_id: "session-1",
  cost_center_id: "center-1",
  expense_category_id: "category-1",
  inventory_item_id: null,
  supplier_id: null,
  title: "Cleaning supplies",
  amount: 25,
  quantity: null,
  unit_cost: null,
  payment_method: "cash",
  expense_source: "session_cash",
  notes: "",
  receipt_url: null,
  created_by: "cashier-1",
};

const savedExpense: Expense = {
  id: "expense-1",
  created_at: new Date().toISOString(),
  status: "approved",
  approved_by: "cashier-1",
  approved_at: new Date().toISOString(),
  ...baseInput,
};

describe("createExpense", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(settingsService.getExpenseSettings).mockResolvedValue({
      approval_required: false,
      cashier_can_add_session_expense: true,
      cashier_max_expense_amount: null,
      allow_inventory_purchase_from_session: true,
      default_cost_center_packaging: null,
      default_cost_center_cleaning: null,
      default_cost_center_utilities: null,
      prevent_expenses_in_closed_periods: true,
    });
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(categoryRepo.getExpenseCategory).mockResolvedValue({
      id: "category-1",
      org_id: "org-1",
      cost_center_id: "center-1",
      name: "Cleaning",
      is_active: true,
      requires_inventory_item: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.mocked(expenseRepo.createExpense).mockResolvedValue(savedExpense);
    vi.mocked(getOrgId).mockResolvedValue("org-1");
    vi.mocked(writeAuditLog).mockResolvedValue({
      id: "audit-1",
      org_id: "org-1",
      store_id: "store-1",
      user_id: "cashier-1",
      action: "expense.created",
      entity_type: "expense",
      entity_id: "expense-1",
      metadata: {},
      created_at: new Date().toISOString(),
    });
  });

  it("creates a valid cashier session expense", async () => {
    const expense = await createExpense(baseInput, cashier, { isSessionExpense: true });

    expect(expense.id).toBe("expense-1");
    expect(expenseRepo.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store-1",
        session_id: "session-1",
        status: "approved",
        approved_by: "cashier-1",
        amount: 25,
      })
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "session.expense_recorded",
        entityType: "cashier_session",
        entityId: "session-1",
      })
    );
  });

  it("rejects cashier session expenses when disabled in settings", async () => {
    vi.mocked(settingsService.getExpenseSettings).mockResolvedValue({
      approval_required: false,
      cashier_can_add_session_expense: false,
      cashier_max_expense_amount: null,
      allow_inventory_purchase_from_session: true,
      default_cost_center_packaging: null,
      default_cost_center_cleaning: null,
      default_cost_center_utilities: null,
      prevent_expenses_in_closed_periods: true,
    });

    await expect(createExpense(baseInput, cashier, { isSessionExpense: true })).rejects.toThrow(
      "Cashiers cannot add session expenses"
    );
    expect(expenseRepo.createExpense).not.toHaveBeenCalled();
  });

  it("rejects inventory purchase expenses — purchases page only", async () => {
    await expect(
      createExpense(
        {
          ...baseInput,
          inventory_item_id: "product-1",
          quantity: 2,
          unit_cost: 10,
        },
        cashier,
        { isSessionExpense: true }
      )
    ).rejects.toThrow("شراء المخزون من المصروفات غير متاح");

    expect(expenseRepo.createExpense).not.toHaveBeenCalled();
    expect(adjustStock).not.toHaveBeenCalled();
  });

  it("preserves closed-period rejection before creating expenses", async () => {
    vi.mocked(assertPeriodOpen).mockRejectedValue(
      new PeriodClosedError("Operations are blocked: period 2026-01-01 - 2026-01-31 is closed.")
    );

    await expect(createExpense(baseInput, cashier, { isSessionExpense: true })).rejects.toThrow(
      PeriodClosedError
    );
    expect(categoryRepo.getExpenseCategory).not.toHaveBeenCalled();
    expect(expenseRepo.createExpense).not.toHaveBeenCalled();
    expect(sessionRepo.getSession).not.toHaveBeenCalled();
  });
});
