"use client";

import { isValidElement, useMemo, useState, useTransition } from "react";
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
  ExpenseSettings,
  ExpenseSource,
  Product,
} from "@/lib/types";
import { suggestInventoryExpenseDefaults } from "@/modules/accounting/utils/expense-suggest";

const STEPS = ["النوع", "التصنيف", "المبلغ", "الدفع", "التأكيد"] as const;
const STEP_IDS = [0, 1, 2, 3, 4] as const;

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
  products?: Product[];
  suppliers?: { id: string; name: string }[];
  expenseSettings?: ExpenseSettings;
  expense?: Expense;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onDone?: () => void;
  sessionMode?: boolean;
}

export function ExpenseWizard({
  storeId,
  sessionId,
  userId,
  costCenters,
  categories,
  products = [],
  suppliers = [],
  expenseSettings,
  expense,
  trigger,
  defaultOpen = false,
  onDone,
  sessionMode = false,
}: ExpenseWizardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [expenseType, setExpenseType] = useState<"general" | "inventory">("general");
  const [costCenterId, setCostCenterId] = useState(expense?.cost_center_id ?? costCenters[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(expense?.expense_category_id ?? "");
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [title, setTitle] = useState(expense?.title ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [productId, setProductId] = useState(expense?.inventory_item_id ?? "");
  const [quantity, setQuantity] = useState(String(expense?.quantity ?? ""));
  const [unitCost, setUnitCost] = useState(String(expense?.unit_cost ?? ""));
  const [supplierId, setSupplierId] = useState(expense?.supplier_id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(
    expense?.payment_method ?? (sessionMode ? "cash" : "other")
  );
  const [expenseSource, setExpenseSource] = useState<ExpenseSource>(
    expense?.expense_source ?? (sessionMode || sessionId ? "session_cash" : "external")
  );

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.cost_center_id === costCenterId && c.is_active),
    [categories, costCenterId]
  );

  const trackableProducts = products.filter((p) => p.track_inventory);
  const inventoryPurchaseDisabled =
    trackableProducts.length === 0 ||
    (sessionMode && expenseSettings?.allow_inventory_purchase_from_session === false);
  const inventoryDefaults = useMemo(
    () =>
      expenseSettings
        ? suggestInventoryExpenseDefaults(categories, expenseSettings)
        : null,
    [categories, expenseSettings]
  );
  /** Inventory purchase uses accounting defaults — cashier shouldn't pick cost centers. */
  const hideAccountingFields =
    expenseType === "inventory" && Boolean(inventoryDefaults);
  const visibleSteps = STEPS;
  const visibleStepIds = STEP_IDS;
  const currentStep = visibleStepIds[step] ?? 0;
  const computedAmount = useMemo(() => {
    if (expenseType === "inventory") {
      const q = parseFloat(quantity) || 0;
      const u = parseFloat(unitCost) || 0;
      return q * u;
    }
    return parseFloat(amount) || 0;
  }, [expenseType, quantity, unitCost, amount]);

  function selectExpenseType(type: "general" | "inventory") {
    if (type === "inventory" && inventoryPurchaseDisabled) return;
    setExpenseType(type);
    if (type === "inventory" && inventoryDefaults) {
      setCostCenterId(inventoryDefaults.costCenterId);
      setCategoryId(inventoryDefaults.categoryId);
    }
  }

  function resetForm() {
    setStep(0);
    setExpenseType("general");
    setAmount("");
    setTitle("");
    setNotes("");
    setProductId("");
    setQuantity("");
    setUnitCost("");
    setSupplierId("");
  }

  function handleSubmit() {
    const value = computedAmount;
    if (!categoryId || !costCenterId) {
      toast.error("اختار مركز التكلفة والتصنيف");
      return;
    }
    if (expenseType === "inventory") {
      if (sessionMode && expenseSettings?.allow_inventory_purchase_from_session === false) {
        toast.error("شراء المخزون من الجلسة غير مفعل");
        return;
      }
      if (!productId) {
        toast.error("اختار صنف مخزون");
        return;
      }
      if ((parseFloat(quantity) || 0) <= 0) {
        toast.error("اكتب كمية صحيحة");
        return;
      }
      if ((parseFloat(unitCost) || 0) <= 0) {
        toast.error("اكتب تكلفة وحدة صحيحة");
        return;
      }
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
          cost_center_id: costCenterId,
          expense_category_id: categoryId,
          inventory_item_id: expenseType === "inventory" ? productId || null : null,
          supplier_id: supplierId || null,
          title: title || (expenseType === "inventory" ? "شراء مخزون" : "مصروف"),
          amount: value,
          quantity: expenseType === "inventory" ? parseFloat(quantity) : null,
          unit_cost: expenseType === "inventory" ? parseFloat(unitCost) : null,
          payment_method: paymentMethod,
          expense_source: expenseSource,
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
          await createExpenseAction(payload, { isSessionExpense: sessionMode || Boolean(sessionId) });
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

  function handleDelete() {
    if (!expense) return;
    setDeleteConfirmOpen(true);
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

  const sessionContent = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">مصروف من درج الجلسة (نقدي).</p>
      {!inventoryPurchaseDisabled ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={expenseType === "general" ? "default" : "outline"}
            className="rounded-xl justify-start"
            onClick={() => selectExpenseType("general")}
          >
            مصروف عام
          </Button>
          <Button
            type="button"
            variant={expenseType === "inventory" ? "default" : "outline"}
            className="rounded-xl justify-start"
            onClick={() => selectExpenseType("inventory")}
          >
            شراء مخزون
          </Button>
        </div>
      ) : null}
      {expenseType === "inventory" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="session-expense-product">صنف المخزون</Label>
            <select
              id="session-expense-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">اختار الصنف</option>
              {trackableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-expense-qty">الكمية</Label>
              <Input
                id="session-expense-qty"
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-expense-unit-cost">تكلفة الوحدة</Label>
              <Input
                id="session-expense-unit-cost"
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          {suppliers.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="session-expense-supplier">المورد (اختياري)</Label>
              <select
                id="session-expense-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                <option value="">لا يوجد</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            الإجمالي: {computedAmount.toFixed(2)}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="session-expense-title">العنوان</Label>
            <Input
              id="session-expense-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
              placeholder="مثال: توصيل / أدوات نظافة"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-expense-amount">المبلغ</Label>
            <Input
              id="session-expense-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-xl text-base"
            />
          </div>
        </>
      )}
      {!hideAccountingFields ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="session-expense-center">مركز التكلفة</Label>
            <select
              id="session-expense-center"
              value={costCenterId}
              onChange={(e) => {
                setCostCenterId(e.target.value);
                setCategoryId("");
              }}
              className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {costCenters.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-expense-category">التصنيف</Label>
            <select
              id="session-expense-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">اختار التصنيف</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="session-expense-notes">ملاحظة (اختياري)</Label>
        <Textarea
          id="session-expense-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-xl"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" className="flex-1 rounded-xl" disabled={pending} onClick={handleSubmit}>
          {expense ? "تحديث" : "حفظ المصروف"}
        </Button>
        {expense ? (
          <Button type="button" variant="destructive" className="rounded-xl" disabled={pending} onClick={handleDelete}>
            حذف
          </Button>
        ) : null}
      </div>
    </div>
  );

  const content = sessionMode ? (
    sessionContent
  ) : (
    <div className="space-y-4">
      <div className="flex gap-1">
        {visibleSteps.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            title={label}
          />
        ))}
      </div>

      {currentStep === 0 && (
        <div className="grid gap-2">
          <Button
            type="button"
            variant={expenseType === "general" ? "default" : "outline"}
            className="rounded-xl justify-start"
            onClick={() => selectExpenseType("general")}
          >
            مصروف عام
          </Button>
          <Button
            type="button"
            variant={expenseType === "inventory" ? "default" : "outline"}
            className="rounded-xl justify-start"
            disabled={inventoryPurchaseDisabled}
            onClick={() => selectExpenseType("inventory")}
          >
            شراء مخزون
          </Button>
        </div>
      )}

      {currentStep === 1 && !hideAccountingFields && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>مركز التكلفة</Label>
            <select
              value={costCenterId}
              onChange={(e) => {
                setCostCenterId(e.target.value);
                setCategoryId("");
              }}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {costCenters.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>التصنيف</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">اختار التصنيف</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {currentStep === 2 && expenseType === "general" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>المبلغ</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      {currentStep === 2 && expenseType === "inventory" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>صنف المخزون</Label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">اختار الصنف</option>
              {trackableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>تكلفة الوحدة</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          {suppliers.length > 0 && (
            <div className="space-y-2">
              <Label>المورد (اختياري)</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                <option value="">لا يوجد</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-sm text-muted-foreground">الإجمالي: {computedAmount.toFixed(2)}</p>
        </div>
      )}

      {currentStep === 3 && !sessionMode && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>مصدر الدفع</Label>
            <select
              value={expenseSource}
              onChange={(e) => setExpenseSource(e.target.value as ExpenseSource)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {EXPENSE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {EXPENSE_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {EXPENSE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {EXPENSE_PAYMENT_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">النوع:</span>{" "}
            {expenseType === "inventory" ? "شراء مخزون" : "مصروف عام"}
          </p>
          <p><span className="text-muted-foreground">المبلغ:</span> {computedAmount.toFixed(2)}</p>
          {!sessionMode && (
            <p>
              <span className="text-muted-foreground">المصدر:</span>{" "}
              {EXPENSE_SOURCE_LABELS[expenseSource]} / {EXPENSE_PAYMENT_LABELS[paymentMethod]}
            </p>
          )}
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" rows={2} />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              const prev = step - 1;
              // Skip accounting step when going back from amount if inventory defaults apply
              if (visibleStepIds[prev] === 1 && hideAccountingFields) {
                setStep(Math.max(0, prev - 1));
                return;
              }
              setStep(prev);
            }}
          >
            رجوع
          </Button>
        )}
        {step < visibleSteps.length - 1 ? (
          <Button
            type="button"
            className="flex-1 rounded-xl"
            onClick={() => {
              const next = step + 1;
              // Skip accounting step when inventory defaults are already applied
              if (visibleStepIds[next] === 1 && hideAccountingFields) {
                setStep(Math.min(visibleSteps.length - 1, next + 1));
                return;
              }
              setStep(next);
            }}
          >
            متابعة
          </Button>
        ) : (
          <Button type="button" className="flex-1 rounded-xl" disabled={pending} onClick={handleSubmit}>
            {expense ? "تحديث" : "تأكيد"}
          </Button>
        )}
        {expense && step === visibleSteps.length - 1 && (
          <Button type="button" variant="destructive" className="rounded-xl" disabled={pending} onClick={handleDelete}>
            حذف
          </Button>
        )}
      </div>
    </div>
  );

  if (trigger === null) {
    return (
      <>
        {content}
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
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{expense ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle>
          </DialogHeader>
          {content}
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
