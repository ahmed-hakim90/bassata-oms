"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search, Star, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PosCustomerSearchResult } from "@/modules/pos/actions/customer-attach.action";
import { usePosStore } from "@/stores/pos-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatCurrency } from "@/lib/format";
import { firstGrapheme } from "@/lib/first-grapheme";

const SEARCH_DEBOUNCE_MS = 250;

function splitQueryHint(query: string): { name: string; phone: string } {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 3 && digits.length >= trimmed.replace(/\s+/g, "").length * 0.6) {
    return { name: "", phone: trimmed };
  }
  return { name: trimmed, phone: "" };
}

async function searchCustomersApi(query: string): Promise<PosCustomerSearchResult[]> {
  const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(query)}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = (await res.json()) as {
    customers?: PosCustomerSearchResult[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || "فشل البحث عن العملاء");
  }
  return data.customers ?? [];
}

async function createCustomerApi(input: {
  name: string;
  phone: string;
}): Promise<PosCustomerSearchResult> {
  const res = await fetch("/api/pos/customers", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    customer?: PosCustomerSearchResult;
    error?: string;
  };
  if (!res.ok || !data.customer) {
    throw new Error(data.error || "فشل إضافة العميل");
  }
  return data.customer;
}

async function fetchLoyaltyBalanceApi(customerId: string): Promise<number> {
  const res = await fetch(`/api/pos/customers/${customerId}/loyalty`, {
    method: "GET",
    credentials: "same-origin",
  });
  const data = (await res.json()) as { balance?: number; error?: string };
  if (!res.ok) {
    throw new Error(data.error || "فشل جلب نقاط الولاء");
  }
  return data.balance ?? 0;
}

export function CustomerAttach({
  loyaltyEnabled = false,
  expanded: expandedProp,
  onExpandedChange,
}: {
  loyaltyEnabled?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const setCustomerLoyaltyBalance = usePosStore((s) => s.setCustomerLoyaltyBalance);
  const [phone, setPhone] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [expandedInternal, setExpandedInternal] = useState(false);
  const [results, setResults] = useState<PosCustomerSearchResult[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controlled = expandedProp !== undefined;
  const expanded = controlled ? expandedProp : expandedInternal;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function setExpanded(next: boolean) {
    if (!next) {
      setPhone("");
      setResults([]);
      setCreateOpen(false);
      setCreateName("");
      setCreatePhone("");
      searchSeqRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
    if (!controlled) setExpandedInternal(next);
    onExpandedChange?.(next);
  }

  function attachCustomer(c: PosCustomerSearchResult) {
    setCustomer(c);
    setExpanded(false);
    setPhone("");
    setResults([]);
    if (c.account_balance > 0) {
      toast.info(`${c.name}: مستحق ${formatCurrency(c.account_balance)}`);
    }
    if (!loyaltyEnabled) {
      setCustomerLoyaltyBalance(null);
      setLoyaltyLoading(false);
      return;
    }

    if (typeof c.loyalty_balance === "number") {
      setCustomerLoyaltyBalance(c.loyalty_balance);
      setLoyaltyLoading(false);
      if (c.loyalty_balance > 0) {
        toast.info(`${c.name}: ${c.loyalty_balance} نقطة جاهزة للاستبدال`);
      }
      return;
    }

    setLoyaltyLoading(true);
    setCustomerLoyaltyBalance(null);
    startTransition(async () => {
      try {
        const balance = await fetchLoyaltyBalanceApi(c.id);
        setCustomerLoyaltyBalance(balance);
        if (balance > 0) {
          toast.info(`${c.name}: ${balance} نقطة جاهزة للاستبدال`);
        }
      } catch {
        setCustomerLoyaltyBalance(0);
      } finally {
        setLoyaltyLoading(false);
      }
    });
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      searchSeqRef.current += 1;
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const seq = ++searchSeqRef.current;
      const query = value;
      startTransition(async () => {
        try {
          const found = await searchCustomersApi(query);
          if (seq !== searchSeqRef.current) return;
          setResults(found);
        } catch (error) {
          if (seq !== searchSeqRef.current) return;
          setResults([]);
          toast.error(error instanceof Error ? error.message : "فشل البحث عن العملاء");
        }
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  function openCreateForm() {
    const hint = splitQueryHint(phone);
    setCreateName(hint.name || "زائر");
    setCreatePhone(hint.phone);
    setCreateOpen(true);
  }

  function handleCreate() {
    const name = createName.trim();
    const phoneValue = createPhone.trim();
    if (!name) {
      toast.error("اكتب اسم العميل");
      return;
    }
    if (!phoneValue) {
      toast.error("اكتب رقم الهاتف");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createCustomerApi({
          name,
          phone: phoneValue,
        });
        toast.success(`تم إضافة ${created.name}`);
        attachCustomer(created);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "فشل إضافة العميل");
      }
    });
  }

  if (!customer && !expanded) return null;

  return (
    <div className="border-b px-4 py-2.5">
      {customer ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {customer.name.trim() ? firstGrapheme(customer.name) : <UserRound className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {customer.phone}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {customer.account_balance > 0 ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                  مستحق {formatCurrency(customer.account_balance)}
                </span>
              ) : null}
              {loyaltyEnabled && loyaltyLoading ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Star className="size-3 animate-pulse" />
                  جاري جلب النقاط…
                </span>
              ) : null}
              {loyaltyEnabled && !loyaltyLoading && loyaltyBalance !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <Star className="size-3" />
                  {loyaltyBalance} {t("points")}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-9 shrink-0 rounded-xl"
            aria-label="إزالة العميل"
            onClick={() => {
              setCustomer(null);
              setLoyaltyLoading(false);
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : createOpen ? (
        <div className="space-y-2">
          <Input
            placeholder="اسم العميل"
            aria-label="اسم العميل"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="h-11 rounded-xl"
            autoFocus
          />
          <Input
            placeholder="رقم الهاتف"
            aria-label="رقم الهاتف"
            value={createPhone}
            onChange={(e) => setCreatePhone(e.target.value)}
            className="h-11 rounded-xl"
            dir="ltr"
            inputMode="tel"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={() => setCreateOpen(false)}
              disabled={pending}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={handleCreate}
              disabled={pending}
            >
              <UserPlus className="size-3.5" />
              حفظ وربط
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="اسم أو رقم هاتف"
              aria-label="بحث عن عميل"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-11 rounded-xl ps-8"
              autoFocus
            />
          </div>
          {results.length > 0 ? (
            <ul className="max-h-40 space-y-1.5 overflow-y-auto">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-start transition-colors hover:bg-muted/60"
                    onClick={() => attachCustomer(c)}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                      {firstGrapheme(c.name, "؟")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground" dir="ltr">
                        {c.phone}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {c.account_balance > 0 ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                          {formatCurrency(c.account_balance)}
                        </span>
                      ) : null}
                      {loyaltyEnabled && typeof c.loyalty_balance === "number" && c.loyalty_balance > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          <Star className="size-3" />
                          {c.loyalty_balance}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : phone.length >= 3 ? (
            <p className="px-1 py-2 text-center text-xs text-muted-foreground">
              لا توجد نتائج
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={() => setExpanded(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={openCreateForm}
            >
              <UserPlus className="size-3.5" />
              {t("New guest")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
