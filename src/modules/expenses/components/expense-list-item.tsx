"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { StatusPill } from "@/components/Velora/status-pill";
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

  const createdLabel = new Date(expense.created_at).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <MobileEntityCard
      title={expense.title}
      subtitle={`${centerName} · ${categoryName}`}
      badge={
        <StatusPill
          label={STATUS_LABELS[expense.status] ?? expense.status}
          variant={expense.status === "approved" ? "success" : "warning"}
        />
      }
      fields={[
        { label: "المبلغ", value: formatCurrency(expense.amount) },
        { label: "التاريخ", value: createdLabel },
        {
          label: "المصدر",
          value: SOURCE_LABELS[expense.expense_source] ?? expense.expense_source,
        },
        { label: "الدفع", value: t(expense.payment_method) },
        ...(expense.inventory_item_id && expense.quantity
          ? [
              {
                label: "الكمية",
                value: `${expense.quantity} × ${expense.unit_cost ?? 0}`,
              },
            ]
          : []),
      ]}
      footer={
        expense.status === "pending" && canApprove ? (
          <Button size="sm" className="w-full sm:w-auto" disabled={pending} onClick={handleApprove}>
            اعتماد
          </Button>
        ) : undefined
      }
    />
  );
}
