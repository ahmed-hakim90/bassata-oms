import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createExpense,
  deleteExpense,
  type CreateExpenseInput,
} from "@/modules/expenses/services/expense.service";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
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
vi.mock("@/modules/accounting/services/gl-posting.service", () => ({
  safePostExpenseJournal: vi.fn(),
  safeReversePostedBySource: vi.fn(),
}));
vi.mock("@/modules/treasury/services/treasury.service", () => ({
  postExpenseToTreasury: vi.fn(),
  reverseExpenseFromTreasury: vi.fn(),
}));

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
      gl_account_id: null,
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

  it("records owner operational expenses as the signed-in user, not a POS cashier", async () => {
    const owner: AppUser = {
      ...cashier,
      id: "owner-1",
      auth_user_id: "auth-owner",
      name: "Owner",
      email: "owner@test.com",
      role: "owner",
    };

    await createExpense(
      {
        ...baseInput,
        session_id: "session-spoof",
        created_by: "spoofed-cashier",
        expense_source: "external",
        payment_method: "card",
      },
      owner,
      { isSessionExpense: false }
    );

    expect(expenseRepo.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by: "owner-1",
        session_id: null,
        expense_source: "external",
        payment_method: "card",
      })
    );
    expect(writeAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "session.expense_recorded" })
    );
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

  it("rejects mixing session drawer expenses with a treasury_id", async () => {
    await expect(
      createExpense(
        {
          ...baseInput,
          treasury_id: "treasury-1",
        },
        cashier,
        { isSessionExpense: true }
      )
    ).rejects.toThrow(/الدرج/);

    expect(expenseRepo.createExpense).not.toHaveBeenCalled();
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

describe("deleteExpense", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrgId).mockResolvedValue("org-1");
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
  });

  it("reverses treasury cash before deleting a treasury expense", async () => {
    const { reverseExpenseFromTreasury } = await import(
      "@/modules/treasury/services/treasury.service"
    );
    const { safeReversePostedBySource } = await import(
      "@/modules/accounting/services/gl-posting.service"
    );
    const treasuryExpense: Expense = {
      ...savedExpense,
      session_id: null,
      expense_source: "external",
      treasury_id: "tr-1",
    };
    vi.mocked(expenseRepo.getExpense).mockResolvedValue(treasuryExpense);
    vi.mocked(expenseRepo.deleteExpense).mockResolvedValue(true);

    await expect(deleteExpense(treasuryExpense.id, cashier)).resolves.toBe(true);

    expect(reverseExpenseFromTreasury).toHaveBeenCalledWith(treasuryExpense.id);
    expect(safeReversePostedBySource).toHaveBeenCalled();
    expect(expenseRepo.deleteExpense).toHaveBeenCalledWith(treasuryExpense.id);
  });

  it("does not delete when treasury reverse fails", async () => {
    const { reverseExpenseFromTreasury } = await import(
      "@/modules/treasury/services/treasury.service"
    );
    vi.mocked(expenseRepo.getExpense).mockResolvedValue({
      ...savedExpense,
      session_id: null,
      expense_source: "external",
      treasury_id: "tr-1",
    });
    vi.mocked(reverseExpenseFromTreasury).mockRejectedValue(
      new Error("رصيد الخزينة غير كافٍ")
    );

    await expect(deleteExpense("expense-1", cashier)).rejects.toThrow(/رصيد الخزينة/);
    expect(expenseRepo.deleteExpense).not.toHaveBeenCalled();
  });
});
