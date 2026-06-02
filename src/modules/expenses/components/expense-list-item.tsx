"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import { approveExpenseAction } from "@/modules/expenses/actions/expense.actions";
import type { Expense } from "@/lib/types";

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
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveExpenseAction(expense.id);
        toast.success("Expense approved");
      } catch {
        toast.error("Could not approve expense");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
      <div>
        <p className="font-medium">{expense.title}</p>
        <p className="text-xs text-muted-foreground">
          {centerName} · {categoryName}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(expense.created_at), "MMM d, h:mm a")} · {expense.expense_source} ·{" "}
          {expense.payment_method}
          {expense.inventory_item_id && expense.quantity
            ? ` · ${expense.quantity} × ${expense.unit_cost ?? 0}`
            : null}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill
          label={expense.status}
          variant={expense.status === "approved" ? "success" : "warning"}
        />
        {expense.status === "pending" && canApprove && (
          <Button size="sm" className="rounded-xl" disabled={pending} onClick={handleApprove}>
            Approve
          </Button>
        )}
        <span className="font-semibold tabular-nums">{formatCurrency(expense.amount)}</span>
      </div>
    </li>
  );
}
