"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Banknote, CreditCard, Search, Truck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";
import { listSuppliersForPosPaymentAction } from "@/modules/suppliers/actions/supplier.actions";
import { playPosErrorSound, playPosSuccessSound } from "@/modules/pos/lib/pos-sounds";
import { cn } from "@/lib/utils";
import { firstGrapheme } from "@/lib/first-grapheme";

async function postPosSupplierPayment(input: {
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const res = await fetch("/api/pos/supplier-payment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { success?: boolean; error?: string };
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || "تعذر تسجيل دفعة المورد" };
  }
  return { success: true };
}

const METHOD_META: {
  id: Exclude<PaymentMethod, "credit">;
  label: string;
  icon: typeof Banknote;
  className: string;
}[] = [
  {
    id: "cash",
    label: "نقدي",
    icon: Banknote,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 data-[selected=true]:border-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  {
    id: "card",
    label: "كارت",
    icon: CreditCard,
    className:
      "border-sky-200 bg-sky-50 text-sky-800 data-[selected=true]:border-sky-500 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  },
  {
    id: "wallet",
    label: "محفظة",
    icon: Wallet,
    className:
      "border-violet-200 bg-violet-50 text-violet-800 data-[selected=true]:border-violet-500 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  },
  {
    id: "other",
    label: "أخرى",
    icon: Banknote,
    className:
      "border-slate-200 bg-slate-50 text-slate-800 data-[selected=true]:border-slate-500 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200",
  },
];

type PaySupplier = {
  id: string;
  name: string;
  balanceDue: number;
};

interface PosSupplierPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PosSupplierPayDialog({ open, onOpenChange }: PosSupplierPayDialogProps) {
  const [pending, startTransition] = useTransition();
  const [loadingList, startListTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState<PaySupplier[]>([]);
  const [selected, setSelected] = useState<PaySupplier | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Exclude<PaymentMethod, "credit">>("cash");
  const [reference, setReference] = useState("");

  function resetForm(supplier: PaySupplier | null = null) {
    setSelected(supplier);
    setAmount(
      supplier && supplier.balanceDue > 0 ? String(supplier.balanceDue) : ""
    );
    setMethod("cash");
    setReference("");
  }

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      resetForm(null);
    }
  }

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    startListTransition(async () => {
      try {
        const rows = await listSuppliersForPosPaymentAction();
        if (!cancelled) setSuppliers(rows);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "تعذر تحميل الموردين"
          );
          setSuppliers([]);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const list = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(trimmed));
  }, [suppliers, query]);

  const balanceDue = selected?.balanceDue ?? 0;
  const value = Number(amount);
  const canSubmit =
    Boolean(selected) && Number.isFinite(value) && value > 0 && !pending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      resetForm(null);
    }
    onOpenChange(next);
  }

  function handlePay() {
    if (!selected || !canSubmit) return;
    startTransition(async () => {
      try {
        const result = await postPosSupplierPayment({
          supplierId: selected.id,
          amount: value,
          paymentMethod: method,
          reference: reference.trim() || undefined,
        });
        if (!result.success) {
          playPosErrorSound();
          toast.error(result.error);
          return;
        }
        toast.success(`تم تسجيل دفعة ${formatCurrency(value)} لـ ${selected.name}`);
        playPosSuccessSound();
        handleOpenChange(false);
      } catch (error) {
        playPosErrorSound();
        toast.error(error instanceof Error ? error.message : "تعذر تسجيل دفعة المورد");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="space-y-2 border-b border-border/70 px-4 py-4 text-start">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
            <Truck className="size-5" />
          </div>
          <DialogTitle>{selected ? "دفعة للمورد" : "دفعات الموردين"}</DialogTitle>
          <DialogDescription>
            {selected
              ? `${selected.name} · الرصيد ${formatCurrency(balanceDue)}`
              : "اختر موردًا و سجّل دفعة من أدراج الجلسة — تتظبط مع الفاتورة بعدين"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70dvh,560px)] space-y-4 overflow-y-auto px-4 py-4">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث باسم المورد…"
                  aria-label="بحث عن مورد"
                  className="h-11 rounded-xl ps-10"
                  autoFocus
                />
              </div>

              {loadingList && list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>
              ) : list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? "لا يوجد مورد مطابق للبحث" : "لا يوجد موردين"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {list.map((supplier) => (
                    <li key={supplier.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
                        onClick={() => resetForm(supplier)}
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                          {firstGrapheme(supplier.name, "؟")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{supplier.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {supplier.balanceDue > 0
                              ? `مستحق ${formatCurrency(supplier.balanceDue)}`
                              : supplier.balanceDue < 0
                                ? `سلفة ${formatCurrency(Math.abs(supplier.balanceDue))}`
                                : "رصيد صفر"}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                            supplier.balanceDue > 0
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {formatCurrency(supplier.balanceDue)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => resetForm(null)}
              >
                <ArrowRight className="size-4" />
                تغيير المورد
              </button>

              <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {firstGrapheme(selected.name, "؟")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    رصيد حالي {formatCurrency(balanceDue)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pos-supplier-pay-amount">المبلغ</Label>
                <Input
                  id="pos-supplier-pay-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-xl text-base"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  تقدر تدفع قبل الفاتورة — الرصيد يتظبط لما تستلم المشتريات
                </p>
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {METHOD_META.filter((m) => PAYMENT_METHODS.includes(m.id)).map(
                    ({ id, label, icon: Icon, className }) => (
                      <button
                        key={id}
                        type="button"
                        data-selected={method === id}
                        onClick={() => setMethod(id)}
                        className={cn(
                          "flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-semibold",
                          className
                        )}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    )
                  )}
                </div>
                {method === "cash" ? (
                  <p className="text-xs text-muted-foreground">
                    النقدي هينقص من أدراج الجلسة عند الإغلاق
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-supplier-pay-ref">مرجع (اختياري)</Label>
                <Input
                  id="pos-supplier-pay-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="rounded-xl"
                  placeholder="رقم إيصال / ملاحظة"
                />
              </div>
            </>
          )}
        </div>

        {selected ? (
          <DialogFooter className="gap-2 border-t border-border/70 px-4 py-3 sm:justify-start">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={handlePay}>
              {pending ? "جاري التسجيل…" : "تأكيد الدفعة"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
