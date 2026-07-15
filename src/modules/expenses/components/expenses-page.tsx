import { AccessDenied } from "@/components/SweetFlow/access-denied";
import {
  getValidatedActiveStoreId,
  requireAnyPermission,
  requirePermission,
} from "@/lib/auth/guards";
import { runPageAuth } from "@/lib/auth/page-guard";
import { getPosReadiness } from "@/lib/auth/pos-readiness";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { PosReadinessStatus } from "@/components/SweetFlow/pos-readiness-status";
import { ExpenseWizard } from "@/modules/expenses/components/expense-wizard";
import { ExpenseFiltersBar } from "@/modules/expenses/components/expense-filters-bar";
import { ExpenseListItem } from "@/modules/expenses/components/expense-list-item";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { Button } from "@/components/ui/button";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
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
  const boot = await runPageAuth(async () => {
    await requireAnyPermission(["expense_view_all", "expense_create", "session_expense_create"]);
    return getValidatedActiveStoreId();
  }, "/expenses");
  if (!boot.ok) {
    return <AccessDenied title={boot.denial.title} description={boot.denial.description} />;
  }
  const storeId = boot.data;
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

  const [expenses, costCenters, categories] = await Promise.all([
    expenseRepo.listExpenses(listFilters),
    listCostCenters(storeId),
    listExpenseCategories(),
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
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="إدارة المصروفات"
        description={
          pendingCount > 0
            ? `${pendingCount} مصروف قيد الاعتماد — راجع القائمة ووافق أو ارفض.`
            : "تسجيل واعتماد مصروفات الفرع — مش تقرير التجميع."
        }
        action={
          <ExpenseWizard
            storeId={storeId}
            sessionId={readiness.sessionId}
            userId={readiness.cashierId ?? ""}
            costCenters={costCenters}
            categories={categories}
            sessionMode={Boolean(readiness.sessionId)}
            trigger={<Button className="shadow-[var(--mds-elevation-1)]">إضافة مصروف</Button>}
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
        <EmptyStateBlock
          title="مفيش مصروفات مطابقة للفلاتر"
          description="غيّر الفلاتر أو سجّل مصروف جديد من هنا."
          action={
            <ExpenseWizard
              storeId={storeId}
              sessionId={readiness.sessionId}
              userId={readiness.cashierId ?? ""}
              costCenters={costCenters}
              categories={categories}
              sessionMode={Boolean(readiness.sessionId)}
              trigger={<Button>إضافة مصروف</Button>}
            />
          }
        />
      ) : (
        <ul className="flex flex-col gap-[var(--mds-space-2)]">
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
