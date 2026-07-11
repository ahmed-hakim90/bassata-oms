"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import type { Store } from "@/lib/types";

interface SessionsStoreFilterProps {
  stores: Store[];
  value: string;
}

export function SessionsStoreFilter({ stores, value }: SessionsStoreFilterProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sessions-store-filter" className="sr-only">
        الفرع
      </Label>
      <select
        id="sessions-store-filter"
        className="flex h-9 rounded-xl border border-input bg-transparent px-3 text-sm"
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(window.location.search);
          if (e.target.value === "all") {
            params.delete("storeId");
          } else {
            params.set("storeId", e.target.value);
          }
          const query = params.toString();
          router.push(query ? `/sessions?${query}` : "/sessions");
        }}
      >
        <option value="all">كل الفروع</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </div>
  );
}
