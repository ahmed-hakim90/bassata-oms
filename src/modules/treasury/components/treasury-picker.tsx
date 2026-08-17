"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listTreasuryOptionsAction } from "@/modules/treasury/actions/treasury.actions";
import type { TreasurySummary } from "@/modules/treasury/lib/treasury-view";

interface TreasuryPickerProps {
  value: string;
  onChange: (treasuryId: string) => void;
  /** Prefer store treasury for this store when loading. */
  preferredStoreId?: string;
  /** Include HQ (default true for managers). */
  includeHq?: boolean;
  label?: string;
  disabled?: boolean;
}

export function TreasuryPicker({
  value,
  onChange,
  preferredStoreId,
  includeHq = true,
  label = "الخزينة",
  disabled,
}: TreasuryPickerProps) {
  const [options, setOptions] = useState<TreasurySummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listTreasuryOptionsAction()
      .then((rows) => {
        if (cancelled) return;
        const filtered = rows.filter(
          (t) =>
            (includeHq && t.kind === "hq") ||
            (preferredStoreId ? t.store_id === preferredStoreId : t.kind === "store")
        );
        setOptions(filtered);
        if (!value) {
          const storeTreasury = preferredStoreId
            ? filtered.find((t) => t.kind === "store" && t.store_id === preferredStoreId)
            : null;
          onChange(storeTreasury?.id ?? filtered[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per preferred store
  }, [preferredStoreId, includeHq]);

  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value || undefined}
        onValueChange={(v) => onChange(v ?? "")}
        disabled={disabled}
      >
        <SelectTrigger className="h-11 rounded-xl">
          <SelectValue placeholder="اختار الخزينة" />
        </SelectTrigger>
        <SelectContent>
          {options.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
