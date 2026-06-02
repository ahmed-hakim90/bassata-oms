import { getValidatedActiveStoreId, requireAnyPermission, requirePermission } from "@/lib/auth/guards";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { PosReadinessStatus } from "@/components/SweetFlow/pos-readiness-status";
import { ExpenseWizard } from "@/modules/expenses/components/expense-wizard";
import { ExpenseFiltersBar } from "@/modules/expenses/components/expense-filters-bar";
import { ExpenseListItem } from "@/modules/expenses/components/expense-list-item";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExpenseSource, ExpenseStatus } from "@/lib/types";

interface ExpensesPageProps {
  filters?: {
    costCenterId?: string;
    categoryId?: string;
    source?: string;
    status?: string;
    from?: string;
    to?: string;
  };
}

export async function ExpensesPage({ filters = {} }: ExpensesPageProps) {
  await requireAnyPermission(["expense_view_all", "expense_create", "session_expense_create"]);
  const storeId = await getValidatedActiveStoreId();
  const readiness = await getPosReadiness();

  const listFilters = {
    storeId,
    costCenterId: filters.costCenterId,
    expenseCategoryId: filters.categoryId,
    expenseSource: filters.source as ExpenseSource | undefined,
    status: filters.status as ExpenseStatus | undefined,
    from: filters.from,
    to: filters.to,
  };

  const [expenses, costCenters, categories, products, suppliers] = await Promise.all([
    expenseRepo.listExpenses(listFilters),
    listCostCenters(storeId),
    listExpenseCategories(),
    catalogRepo.listProducts(),
    purchaseRepo.listSuppliers(),
  ]);

  let canApprove = false;
  try {
    await requirePermission("expense_approve");
    canApprove = true;
  } catch {
    canApprove = false;
  }

  const centerMap = new Map(costCenters.map((c) => [c.id, c.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const pendingCount = expenses.filter((e) => e.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={
          pendingCount > 0
            ? `Structured expenses · ${pendingCount} pending approval`
            : "Structured expenses by cost center and category"
        }
        action={
          <ExpenseWizard
            storeId={storeId}
            sessionId={readiness.sessionId}
            userId={readiness.cashierId ?? ""}
            costCenters={costCenters}
            categories={categories}
            products={products}
            suppliers={suppliers}
            sessionMode={Boolean(readiness.sessionId)}
            trigger={<Button className="rounded-xl">Add expense</Button>}
          />
        }
      />

      <ExpenseFiltersBar
        costCenters={costCenters}
        categories={categories}
        values={{
          costCenterId: filters.costCenterId ?? "",
          categoryId: filters.categoryId ?? "",
          source: filters.source ?? "",
          status: filters.status ?? "",
          from: filters.from ?? "",
          to: filters.to ?? "",
        }}
      />

      {readiness.state !== "ready" ? <PosReadinessStatus readiness={readiness} /> : null}

      {expenses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Wallet className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No expenses match your filters</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <ExpenseListItem
              key={e.id}
              expense={e}
              centerName={centerMap.get(e.cost_center_id) ?? "—"}
              categoryName={categoryMap.get(e.expense_category_id) ?? "—"}
              canApprove={canApprove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
