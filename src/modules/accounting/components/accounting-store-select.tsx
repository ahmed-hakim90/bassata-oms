"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabelById } from "@/lib/select-label";
import type { Store } from "@/lib/types";
import {
  ACCOUNTING_ALL_STORES,
  ACCOUNTING_REPORT_STORE_HINT,
} from "@/modules/accounting/lib/report-store";

interface AccountingStoreSelectProps {
  stores: Store[];
  value: string;
  onValueChange: (storeId: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  /** Report filters only. Journal create must keep a real store. */
  allowAll?: boolean;
}

/** Store picker with Base UI label resolution (never shows raw UUID). */
export function AccountingStoreSelect({
  stores,
  value,
  onValueChange,
  id,
  label = "الفرع",
  disabled,
  allowAll = false,
}: AccountingStoreSelectProps) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next) onValueChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue placeholder={label}>
            {(selected) =>
              selected === ACCOUNTING_ALL_STORES
                ? "كل الفروع"
                : selectLabelById(stores, selected, (store) => store.name)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowAll ? (
            <SelectItem value={ACCOUNTING_ALL_STORES} label="كل الفروع">
              كل الفروع
            </SelectItem>
          ) : null}
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id} label={store.name}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {allowAll ? (
        <p className="text-xs text-muted-foreground">{ACCOUNTING_REPORT_STORE_HINT}</p>
      ) : null}
    </div>
  );
}
