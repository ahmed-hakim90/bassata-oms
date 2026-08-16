import { AccessDenied } from "@/components/Velora/access-denied";
import {
  getValidatedActiveStoreId,
  requireAnyPermission,
  requirePermission,
} from "@/lib/auth/guards";
import { runPageAuth } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/Velora/page-header";
import { ExpenseWizard } from "@/modules/expenses/components/expense-wizard";
import { ExpenseFiltersBar } from "@/modules/expenses/components/expense-filters-bar";
import { ExpenseListItem } from "@/modules/expenses/components/expense-list-item";
import { ExpensesAnalyticsGlance } from "@/modules/expenses/components/expenses-analytics-glance";
import { buildExpensesGlance } from "@/modules/expenses/lib/expenses-glance";
import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { Button } from "@/components/ui/button";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
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
    const user = await requireAnyPermission([
      "expense_view_all",
      "expense_create",
      "session_expense_create",
    ]);
    const storeId = await getValidatedActiveStoreId();
    return { user, storeId };
  }, "/expenses");
  if (!boot.ok) {
    return <AccessDenied title={boot.denial.title} description={boot.denial.description} />;
  }
  const { user, storeId } = boot.data;

  const listFilters = {
    storeId,
    costCenterId: filters.costCenterId,
    expenseCategoryId: filters.categoryId,
    expenseSource: filters.source as ExpenseSource | undefined,
    status: filters.status as ExpenseStatus | undefined,
    from: filters.from,
    to: filters.to,
  };

  const [expenses, costCenters, categories, org] = await Promise.all([
    expenseRepo.listExpenses(listFilters),
    listCostCenters(storeId),
    listExpenseCategories(),
    orgRepo.getOrganization(),
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
  const categoryNames = Object.fromEntries(categoryMap);
  const pendingCount = expenses.filter((e) => e.status === "pending").length;
  const glance = buildExpensesGlance({ expenses, categoryNames });

  return (
    <div className="flex flex-col gap-3">
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
            sessionId={null}
            userId={user.id}
            costCenters={costCenters}
            categories={categories}
            trigger={<Button className="shadow-[var(--mds-elevation-1)]">إضافة مصروف</Button>}
          />
        }
      />

      <ExpensesAnalyticsGlance glance={glance} currency={org.currency} />

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

      {expenses.length === 0 ? (
        <EmptyStateBlock
          title="مفيش مصروفات مطابقة للفلاتر"
          description="غيّر الفلاتر أو سجّل مصروف جديد من هنا."
          action={
            <ExpenseWizard
              storeId={storeId}
              sessionId={null}
              userId={user.id}
              costCenters={costCenters}
              categories={categories}
              trigger={<Button>إضافة مصروف</Button>}
            />
          }
        />
      ) : (
        <div className="flex flex-col gap-[var(--mds-space-2)]">
          {expenses.map((e) => (
            <ExpenseListItem
              key={e.id}
              expense={e}
              centerName={centerMap.get(e.cost_center_id) ?? "—"}
              categoryName={categoryMap.get(e.expense_category_id) ?? "—"}
              canApprove={canApprove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
