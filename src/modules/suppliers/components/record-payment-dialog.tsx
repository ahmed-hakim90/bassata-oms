"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemMeta,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { PaymentMethod, SupplierListSummary } from "@/lib/types";
import { createSupplierPaymentAction } from "@/modules/suppliers/actions/supplier.actions";
import { TreasuryPicker } from "@/modules/treasury/components/treasury-picker";

type SupplierOption = Pick<SupplierListSummary, "id" | "name" | "balanceDue">;

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Fixed supplier — picker hidden. */
  supplierId?: string;
  /** When selecting a supplier (dashboard / list quick pay). */
  suppliers?: SupplierOption[];
  currency?: string;
  /** Pre-select when opening in picker mode. */
  initialSupplierId?: string;
  /** Suppliers list still loading (dashboard quick open). */
  loading?: boolean;
  storeId?: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  onSuccess,
  supplierId: fixedSupplierId,
  suppliers,
  currency,
  initialSupplierId,
  loading = false,
  storeId,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    fixedSupplierId ?? initialSupplierId ?? ""
  );
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [treasuryId, setTreasuryId] = useState("");

  const pickerMode = !fixedSupplierId;
  const supplierId = fixedSupplierId ?? selectedSupplierId;
  const selectedSummary = suppliers?.find((s) => s.id === supplierId);

  useEffect(() => {
    if (!open) return;
    setSelectedSupplierId(fixedSupplierId ?? initialSupplierId ?? "");
  }, [open, fixedSupplierId, initialSupplierId]);

  const reset = () => {
    setAmount("");
    setPaymentMethod("cash");
    setReference("");
    setNotes("");
    setPaidAt(new Date().toISOString().slice(0, 16));
    setTreasuryId("");
    if (pickerMode) {
      setSelectedSupplierId(initialSupplierId ?? "");
    }
  };

  const submit = () => {
    if (!supplierId) {
      toast.error("اختار المورد");
      return;
    }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast.error("أدخل مبلغ صحيح");
      return;
    }
    if (paymentMethod === "credit") {
      toast.error("لا يمكن تسجيل دفعة مورد بطريقة آجل");
      return;
    }
    if (paymentMethod === "cash" && !treasuryId) {
      toast.error("اختار الخزينة اللي هيتصرف منها السداد النقدي");
      return;
    }
    startTransition(async () => {
      const result = await createSupplierPaymentAction({
        supplierId,
        amount: parsed,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        paidAt: new Date(paidAt).toISOString(),
        treasuryId: paymentMethod === "cash" ? treasuryId : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("تم تسجيل الدفعة");
      reset();
      onOpenChange(false);
      onSuccess();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <StandardModalContent
        size="md"
        title="تسجيل دفعة للمورد"
        description="أدخل تفاصيل الدفعة — ستُضاف لكشف حساب المورد فورًا."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl font-semibold"
              onClick={submit}
              disabled={pending || loading}
            >
              حفظ الدفعة
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {pickerMode ? (
            <div className="space-y-2">
              <Label>المورد</Label>
              {loading ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                  جاري تحميل الموردين…
                </p>
              ) : (
                <Select
                  value={selectedSupplierId || undefined}
                  onValueChange={(v) => setSelectedSupplierId(v ?? "")}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="اختار المورد">
                      {(value) =>
                        value
                          ? (suppliers?.find((s) => s.id === value)?.name ?? value)
                          : null
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id} label={s.name}>
                        <span className="truncate">{s.name}</span>
                        {currency != null ? (
                          <SelectItemMeta>
                            {formatCurrency(s.balanceDue, currency)}
                          </SelectItemMeta>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedSummary && currency != null ? (
                <p className="text-xs text-muted-foreground">
                  الرصيد المستحق حاليًا{" "}
                  {formatCurrency(selectedSummary.balanceDue, currency)}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>المبلغ</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue>{(value) => (value ? t(String(value)) : null)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                  <SelectItem key={m} value={m} label={t(m)}>
                    {t(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === "cash" ? (
            <TreasuryPicker
              value={treasuryId}
              onChange={setTreasuryId}
              preferredStoreId={storeId}
              label="الصرف من خزينة"
            />
          ) : null}
          <div className="space-y-2">
            <Label>المرجع</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="رقم شيك، تحويل…"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الدفع</Label>
            <Input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="min-h-11"
            />
          </div>
        </div>
      </StandardModalContent>
    </Dialog>
  );
}
