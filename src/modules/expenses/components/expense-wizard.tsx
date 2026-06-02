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

const STEPS = ["Type", "Category", "Amount", "Payment", "Confirm"] as const;
const SESSION_STEPS = ["Type", "Category", "Amount", "Confirm"] as const;
const STEP_IDS = [0, 1, 2, 3, 4] as const;
const SESSION_STEP_IDS = [0, 1, 2, 4] as const;

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
  const visibleSteps = sessionMode ? SESSION_STEPS : STEPS;
  const visibleStepIds = sessionMode ? SESSION_STEP_IDS : STEP_IDS;
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
    if (type === "inventory" && expenseSettings) {
      const suggested = suggestInventoryExpenseDefaults(categories, expenseSettings);
      if (suggested) {
        setCostCenterId(suggested.costCenterId);
        setCategoryId(suggested.categoryId);
      }
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
      toast.error("Select cost center and category");
      return;
    }
    if (expenseType === "inventory") {
      if (sessionMode && expenseSettings?.allow_inventory_purchase_from_session === false) {
        toast.error("Inventory purchase from session is disabled");
        return;
      }
      if (!productId) {
        toast.error("Select inventory item");
        return;
      }
      if ((parseFloat(quantity) || 0) <= 0) {
        toast.error("Enter a valid quantity");
        return;
      }
      if ((parseFloat(unitCost) || 0) <= 0) {
        toast.error("Enter a valid unit cost");
        return;
      }
    }
    if (value <= 0) {
      toast.error("Enter a valid amount");
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
          title: title || (expenseType === "inventory" ? "Inventory purchase" : "Expense"),
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
          toast.success("Expense updated");
        } else {
          await createExpenseAction(payload, { isSessionExpense: sessionMode || Boolean(sessionId) });
          toast.success("Expense added");
        }
        setOpen(false);
        resetForm();
        onDone?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save expense");
      }
    });
  }

  function handleDelete() {
    if (!expense || !confirm("Delete this expense?")) return;
    startTransition(async () => {
      try {
        await deleteExpenseAction(expense.id);
        toast.success("Expense deleted");
        setOpen(false);
        onDone?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete expense");
      }
    });
  }

  const content = (
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
            General expense
          </Button>
          <Button
            type="button"
            variant={expenseType === "inventory" ? "default" : "outline"}
            className="rounded-xl justify-start"
            disabled={inventoryPurchaseDisabled}
            onClick={() => selectExpenseType("inventory")}
          >
            Inventory purchase
          </Button>
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Cost center</Label>
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
            <Label>Category</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select category</option>
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
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
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
            <Label>Inventory item</Label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Select item</option>
              {trackableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit cost</Label>
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
              <Label>Supplier (optional)</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Total: {computedAmount.toFixed(2)}</p>
        </div>
      )}

      {currentStep === 3 && !sessionMode && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Payment source</Label>
            <select
              value={expenseSource}
              onChange={(e) => setExpenseSource(e.target.value as ExpenseSource)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {EXPENSE_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
              className="flex h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            >
              {EXPENSE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-3 text-sm">
          <p><span className="text-muted-foreground">Type:</span> {expenseType}</p>
          <p><span className="text-muted-foreground">Amount:</span> {computedAmount.toFixed(2)}</p>
          {!sessionMode && (
            <p><span className="text-muted-foreground">Source:</span> {expenseSource} / {paymentMethod}</p>
          )}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" rows={2} />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {step > 0 && (
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < visibleSteps.length - 1 ? (
          <Button type="button" className="flex-1 rounded-xl" onClick={() => setStep(step + 1)}>
            Next
          </Button>
        ) : (
          <Button type="button" className="flex-1 rounded-xl" disabled={pending} onClick={handleSubmit}>
            {expense ? "Update" : "Confirm"}
          </Button>
        )}
        {expense && step === visibleSteps.length - 1 && (
          <Button type="button" variant="destructive" className="rounded-xl" disabled={pending} onClick={handleDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );

  if (trigger === null) {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined && isValidElement(trigger) ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button className="rounded-xl" />}>
          Add expense
        </DialogTrigger>
      )}
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
