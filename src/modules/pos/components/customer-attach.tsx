"use client";

import { useState, useTransition } from "react";
import { Search, Star, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  quickCreateCustomerAction,
  searchCustomersAction,
} from "@/modules/pos/actions/customer-attach.action";
import { getCustomerLoyaltyBalanceAction } from "@/modules/pos/actions/loyalty-balance.action";
import { usePosStore } from "@/stores/pos-store";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Customer } from "@/lib/types";

export function CustomerAttach({ loyaltyEnabled = false }: { loyaltyEnabled?: boolean }) {
  const { t } = useTranslation();
  const customer = usePosStore((s) => s.customer);
  const loyaltyBalance = usePosStore((s) => s.customerLoyaltyBalance);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const setCustomerLoyaltyBalance = usePosStore((s) => s.setCustomerLoyaltyBalance);
  const [phone, setPhone] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof searchCustomersAction>>
  >([]);
  const [, startTransition] = useTransition();

  function attachCustomer(c: Customer) {
    setCustomer(c);
    setExpanded(false);
    setPhone("");
    setResults([]);
    if (loyaltyEnabled) {
      startTransition(async () => {
        try {
          const balance = await getCustomerLoyaltyBalanceAction(c.id);
          setCustomerLoyaltyBalance(balance);
          if (balance > 0) {
            toast.info(`${c.name}: ${balance} ${t("points")} - ${t("can be used at payment")}`);
          }
        } catch {
          setCustomerLoyaltyBalance(null);
        }
      });
    }
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    if (value.length >= 3) {
      startTransition(async () => {
        const found = await searchCustomersAction(value);
        setResults(found);
      });
    } else {
      setResults([]);
    }
  }

  function handleQuickCreate() {
    startTransition(async () => {
      const created = await quickCreateCustomerAction({
        name: "Guest",
        phone: phone || "+10000000000",
      });
      attachCustomer(created);
    });
  }

  return (
    <div className="border-b px-4 py-2.5">
      {customer ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/5 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{customer.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {customer.phone}
            </p>
            {loyaltyEnabled && loyaltyBalance !== null ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600">
                <Star className="size-3" />
                {t("Points")}: {loyaltyBalance}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-9 rounded-xl"
            onClick={() => setCustomer(null)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : expanded ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("Phone number")}
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-11 rounded-xl pl-8"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <ul className="max-h-28 space-y-1 overflow-y-auto">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="min-h-10 w-full rounded-lg px-2 text-start text-sm hover:bg-muted"
                    onClick={() => attachCustomer(c)}
                  >
                    {c.name} · {c.phone}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
              onClick={handleQuickCreate}
            >
              <UserPlus className="size-3.5" />
              {t("New guest")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-full justify-start rounded-xl text-muted-foreground"
          onClick={() => setExpanded(true)}
        >
          <Search className="size-3.5" />
          {t("Attach customer")}
        </Button>
      )}
    </div>
  );
}
