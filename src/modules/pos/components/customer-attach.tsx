"use client";

import { useState, useTransition } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  quickCreateCustomerAction,
  searchCustomersAction,
} from "@/modules/pos/actions/customer-attach.action";
import { usePosStore } from "@/stores/pos-store";

export function CustomerAttach() {
  const customer = usePosStore((s) => s.customer);
  const setCustomer = usePosStore((s) => s.setCustomer);
  const [phone, setPhone] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof searchCustomersAction>>
  >([]);
  const [, startTransition] = useTransition();

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
      setCustomer(created);
      setExpanded(false);
      setPhone("");
      setResults([]);
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
              placeholder="Phone number"
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
                    className="min-h-10 w-full rounded-lg px-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setCustomer(c);
                      setExpanded(false);
                      setPhone("");
                    }}
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
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-11 flex-1 rounded-xl"
              onClick={handleQuickCreate}
            >
              <UserPlus className="size-3.5" />
              New guest
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
          Attach customer
        </Button>
      )}
    </div>
  );
}
