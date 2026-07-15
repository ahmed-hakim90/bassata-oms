"use client";

import { isValidElement, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/modules/expenses/actions/expense.actions";
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_SOURCES,
} from "@/lib/constants";
import type {
  CostCenter,
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseSource,
} from "@/lib/types";

const EXPENSE_SOURCE_LABELS: Record<ExpenseSource, string> = {
  session_cash: "نقدي الجلسة",
  external: "خارجي",
  purchase: "مشتريات",
};

const EXPENSE_PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: "نقدي",
  card: "كارت",
  wallet: "محفظة",
  other: "أخرى",
};

interface ExpenseWizardProps {
  storeId: string;
  sessionId: string | null;
  userId: string;
  costCenters: CostCenter[];
  categories: ExpenseCategory[];
  expense?: Expense;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onDone?: () => void;
  /** When true: cash from open shift drawer. */
  sessionMode?: boolean;
}

export function ExpenseWizard({
  storeId,
  sessionId,
  userId,
  costCenters,
  categories,
  expense,
  trigger,
  defaultOpen = false,
  onDone,
  sessionMode = false,
}: ExpenseWizardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeCenters = useMemo(
    () => costCenters.filter((c) => c.is_active),
    [costCenters]
  );

  const [categoryId, setCategoryId] = useState(expense?.expense_category_id ?? "");
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [title, setTitle] = useState(expense?.title ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(
    expense?.payment_method ?? "cash"
  );
  const [expenseSource, setExpenseSource] = useState<ExpenseSource>(
    expense?.expense_source ?? (sessionMode || sessionId ? "session_cash" : "external")
  );

  const selectableCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          c.is_active &&
          !c.requires_inventory_item &&
          activeCenters.some((center) => center.id === c.cost_center_id)
      ),
    [categories, activeCenters]
  );

  const categoriesByCenter = useMemo(() => {
    const map = new Map<string, ExpenseCategory[]>();
    for (const cat of selectableCategories) {
      const list = map.get(cat.cost_center_id) ?? [];
      list.push(cat);
      map.set(cat.cost_center_id, list);
    }
    return map;
  }, [selectableCategories]);

  const resolvedCostCenterId = useMemo(() => {
    const selected = selectableCategories.find((c) => c.id === categoryId);
    return selected?.cost_center_id ?? expense?.cost_center_id ?? "";
  }, [selectableCategories, categoryId, expense?.cost_center_id]);

  function resetForm() {
    setCategoryId("");
    setAmount("");
    setTitle("");
    setNotes("");
    setPaymentMethod("cash");
    setExpenseSource(sessionMode || sessionId ? "session_cash" : "external");
  }

  function handleSubmit() {
    const value = parseFloat(amount) || 0;
    if (!categoryId || !resolvedCostCenterId) {
      toast.error("اختار التصنيف");
      return;
    }
    if (value <= 0) {
      toast.error("اكتب مبلغ صحيح");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          store_id: storeId,
          session_id: sessionId,
          cost_center_id: resolvedCostCenterId,
          expense_category_id: categoryId,
          inventory_item_id: null,
          supplier_id: null,
          title: title.trim() || "مصروف",
          amount: value,
          quantity: null,
          unit_cost: null,
          payment_method: sessionMode ? ("cash" as const) : paymentMethod,
          expense_source: sessionMode ? ("session_cash" as const) : expenseSource,
          notes,
          receipt_url: expense?.receipt_url ?? null,
          created_by: userId,
        };

        if (expense) {
          await updateExpenseAction(expense.id, {
            cost_center_id: payload.cost_center_id,
            expense_category_id: payload.expense_category_id,
            title: payload.title,
            amount: payload.amount,
            notes: payload.notes,
            payment_method: payload.payment_method,
            expense_source: payload.expense_source,
          });
          toast.success("تم تحديث المصروف");
        } else {
          await createExpenseAction(payload, {
            isSessionExpense: sessionMode || Boolean(sessionId),
          });
          toast.success("تم إضافة المصروف");
        }
        setOpen(false);
        resetForm();
        onDone?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر حفظ المصروف");
      }
    });
  }

  function confirmDelete() {
    if (!expense) return;
    startTransition(async () => {
      try {
        await deleteExpenseAction(expense.id);
        toast.success("تم حذف المصروف");
        setOpen(false);
        onDone?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر حذف المصروف");
      }
    });
  }

  const form = (
    <div className="space-y-4">
      {sessionMode ? (
        <p className="text-sm text-muted-foreground">
          المصروف بيتخصم من درج الوردية المفتوحة (نقدي). شراء المخزون من{" "}
          <Link
            href="/inventory/purchases"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            المشتريات
          </Link>
          .
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          سجّل مصروف تشغيلي فقط. فواتير الموردين والمخزون من{" "}
          <Link
            href="/inventory/purchases"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            المشتريات
          </Link>
          .
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="expense-title">العنوان</Label>
        <Input
          id="expense-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 rounded-xl"
          placeholder="مثال: توصيل / أدوات نظافة"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-amount">المبلغ</Label>
        <Input
          id="expense-amount"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-11 rounded-xl text-base tabular-nums"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-category">التصنيف</Label>
        <select
          id="expense-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">اختار التصنيف</option>
          {activeCenters.map((center) => {
            const centerCategories = categoriesByCenter.get(center.id) ?? [];
            if (centerCategories.length === 0) return null;
            return (
              <optgroup key={center.id} label={center.name}>
                {centerCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {resolvedCostCenterId ? (
          <p className="text-xs text-muted-foreground">
            مركز التكلفة:{" "}
            {activeCenters.find((c) => c.id === resolvedCostCenterId)?.name ?? "—"}
          </p>
        ) : null}
      </div>

      {!sessionMode ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-source">مصدر الدفع</Label>
            <select
              id="expense-source"
              value={expenseSource}
              onChange={(e) => setExpenseSource(e.target.value as ExpenseSource)}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {EXPENSE_SOURCES.filter((s) => s !== "purchase").map((s) => (
                <option key={s} value={s}>
                  {EXPENSE_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-payment">طريقة الدفع</Label>
            <select
              id="expense-payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {EXPENSE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {EXPENSE_PAYMENT_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="expense-notes">ملاحظة (اختياري)</Label>
        <Textarea
          id="expense-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl"
          rows={2}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          className="h-11 flex-1 rounded-xl"
          disabled={pending}
          onClick={handleSubmit}
        >
          {pending ? "جاري الحفظ…" : expense ? "تحديث" : "حفظ المصروف"}
        </Button>
        {expense ? (
          <Button
            type="button"
            variant="destructive"
            className="h-11 rounded-xl"
            disabled={pending}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            حذف
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (trigger === null) {
    return (
      <>
        {form}
        <ConfirmActionDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="حذف المصروف؟"
          description="هيتشال المصروف ومش هتقدر ترجّعه من هنا."
          confirmLabel="حذف"
          destructive
          onConfirm={confirmDelete}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger !== undefined && isValidElement(trigger) ? (
          <DialogTrigger render={trigger} />
        ) : (
          <DialogTrigger render={<Button className="rounded-xl" />}>
            إضافة مصروف
          </DialogTrigger>
        )}
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{expense ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="حذف المصروف؟"
        description="هيتشال المصروف ومش هتقدر ترجّعه من هنا."
        confirmLabel="حذف"
        destructive
        onConfirm={confirmDelete}
      />
    </>
  );
}
