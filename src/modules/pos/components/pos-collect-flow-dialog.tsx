"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Banknote, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";
import {
  listOutstandingCustomersAction,
  recordCustomerPaymentAction,
} from "@/modules/customers/actions/customer.actions";
import { searchCustomersAction } from "@/modules/pos/actions/customer-attach.action";
import { usePosStore } from "@/stores/pos-store";

const METHOD_LABELS: Record<Exclude<PaymentMethod, "credit">, string> = {
  cash: "كاش",
  card: "كارت",
  wallet: "محفظة",
  other: "أخرى",
};

type CollectCustomer = {
  id: string;
  name: string;
  phone: string;
  account_balance: number;
};

interface PosCollectFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PosCollectFlowDialog({ open, onOpenChange }: PosCollectFlowDialogProps) {
  const cartCustomer = usePosStore((s) => s.customer);
  const setCartCustomer = usePosStore((s) => s.setCustomer);
  const [pending, startTransition] = useTransition();
  const [loadingList, startListTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [outstanding, setOutstanding] = useState<CollectCustomer[]>([]);
  const [searchResults, setSearchResults] = useState<CollectCustomer[]>([]);
  const [selected, setSelected] = useState<CollectCustomer | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Exclude<PaymentMethod, "credit">>("cash");
  const [reference, setReference] = useState("");

  function resetForm(customer: CollectCustomer | null = null) {
    setSelected(customer);
    setAmount(customer && customer.account_balance > 0 ? String(customer.account_balance) : "");
    setMethod("cash");
    setReference("");
  }

  function loadOutstanding() {
    startListTransition(async () => {
      try {
        const rows = await listOutstandingCustomersAction();
        setOutstanding(rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تحميل العملاء المستحقين");
        setOutstanding([]);
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSearchResults([]);
    const preselect =
      cartCustomer && cartCustomer.account_balance > 0
        ? {
            id: cartCustomer.id,
            name: cartCustomer.name,
            phone: cartCustomer.phone,
            account_balance: cartCustomer.account_balance,
          }
        : null;
    resetForm(preselect);
    loadOutstanding();
    // Only re-init when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-gated init
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      startListTransition(async () => {
        try {
          const found = await searchCustomersAction(trimmed);
          setSearchResults(
            found
              .filter((c) => c.account_balance > 0)
              .map((c) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                account_balance: c.account_balance,
              }))
          );
        } catch {
          setSearchResults([]);
        }
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const list = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length >= 2) return searchResults;
    return outstanding;
  }, [outstanding, query, searchResults]);

  const owed = selected?.account_balance ?? 0;
  const value = Number(amount);
  const canSubmit =
    Boolean(selected) &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= owed + 0.001 &&
    !pending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setSearchResults([]);
      resetForm(null);
    }
    onOpenChange(next);
  }

  function handleCollect() {
    if (!selected || !canSubmit) return;
    startTransition(async () => {
      try {
        await recordCustomerPaymentAction({
          customerId: selected.id,
          amount: value,
          paymentMethod: method,
          reference: reference.trim() || undefined,
        });
        const nextBalance = Math.max(0, Math.round((owed - value) * 100) / 100);
        toast.success(`تم تحصيل ${formatCurrency(value)} من ${selected.name}`);
        if (cartCustomer?.id === selected.id) {
          setCartCustomer({ ...cartCustomer, account_balance: nextBalance });
        }
        handleOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر تسجيل التحصيل");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="space-y-2 border-b border-border/70 px-4 py-4 text-start">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Banknote className="size-5" />
          </div>
          <DialogTitle>{selected ? "تحصيل من العميل" : "تحصيل مستحقات"}</DialogTitle>
          <DialogDescription>
            {selected
              ? `${selected.name} · المستحق ${formatCurrency(owed)}`
              : "اختر عميلًا عليه مستحقات أو ابحث بالاسم أو رقم الهاتف"}
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
                  placeholder="ابحث بالاسم أو رقم الهاتف…"
                  aria-label="بحث عن عميل للتحصيل"
                  className="h-11 rounded-xl ps-10"
                  autoFocus
                />
              </div>

              {loadingList && list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>
              ) : list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {query.trim().length >= 2
                    ? "لا يوجد عميل بمستحقات مطابقة"
                    : "لا توجد مستحقات حاليًا"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {list.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
                        onClick={() => resetForm(customer)}
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                          {customer.name.trim().charAt(0) || "؟"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{customer.name}</p>
                          <p className="truncate text-xs text-muted-foreground" dir="ltr">
                            {customer.phone}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                          {formatCurrency(customer.account_balance)}
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
                تغيير العميل
              </button>

              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {selected.name.trim().charAt(0) || "؟"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    {selected.phone}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                  مستحق {formatCurrency(owed)}
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pos-collect-amount">المبلغ</Label>
                <Input
                  id="pos-collect-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-xl text-base"
                  autoFocus
                />
                {value > owed + 0.001 ? (
                  <p className="text-xs text-destructive">المبلغ أكبر من المستحق</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-collect-method">طريقة التحصيل</Label>
                <Select
                  value={method}
                  onValueChange={(v) =>
                    setMethod((v ?? "cash") as Exclude<PaymentMethod, "credit">)
                  }
                >
                  <SelectTrigger id="pos-collect-method" className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                      <SelectItem key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-collect-ref">مرجع (اختياري)</Label>
                <Input
                  id="pos-collect-ref"
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
            <Button type="button" disabled={!canSubmit} onClick={handleCollect}>
              {pending ? "جاري التحصيل…" : "تأكيد التحصيل"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
