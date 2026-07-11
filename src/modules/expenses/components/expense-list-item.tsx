"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import { approveExpenseAction } from "@/modules/expenses/actions/expense.actions";
import type { Expense } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  session_cash: "نقدية الجلسة",
  external: "خارجي",
  purchase: "شراء",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الموافقة",
  approved: "معتمد",
};

interface ExpenseListItemProps {
  expense: Expense;
  centerName: string;
  categoryName: string;
  currency?: string;
  canApprove?: boolean;
}

export function ExpenseListItem({
  expense,
  centerName,
  categoryName,
  canApprove,
}: ExpenseListItemProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveExpenseAction(expense.id);
        toast.success("تم اعتماد المصروف");
      } catch {
        toast.error("تعذر اعتماد المصروف");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] border border-border bg-card px-[var(--mds-space-4)] py-[var(--mds-space-3)] text-card-foreground shadow-[var(--mds-elevation-1)] transition-colors hover:bg-muted/30">
      <div>
        <p className="font-medium">{expense.title}</p>
        <p className="text-xs text-muted-foreground">
          {centerName} · {categoryName}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(expense.created_at).toLocaleString("ar-EG", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          · {SOURCE_LABELS[expense.expense_source] ?? expense.expense_source} ·{" "}
          {t(expense.payment_method)}
          {expense.inventory_item_id && expense.quantity
            ? ` · ${expense.quantity} × ${expense.unit_cost ?? 0}`
            : null}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill
          label={STATUS_LABELS[expense.status] ?? expense.status}
          variant={expense.status === "approved" ? "success" : "warning"}
        />
        {expense.status === "pending" && canApprove && (
          <Button size="sm" disabled={pending} onClick={handleApprove}>
            اعتماد
          </Button>
        )}
        <span className="font-semibold tabular-nums">{formatCurrency(expense.amount)}</span>
      </div>
    </li>
  );
}
