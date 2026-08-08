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

interface AccountingStoreSelectProps {
  stores: Store[];
  value: string;
  onValueChange: (storeId: string) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
}

/** Store picker with Base UI label resolution (never shows raw UUID). */
export function AccountingStoreSelect({
  stores,
  value,
  onValueChange,
  id,
  label = "الفرع",
  disabled,
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
            {(selected) => selectLabelById(stores, selected, (store) => store.name)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id} label={store.name}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
