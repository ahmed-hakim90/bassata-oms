"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Star, Warehouse as WarehouseIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import {
  createWarehouseAction,
  setDefaultWarehouseAction,
  updateWarehouseAction,
} from "@/modules/system/actions/system.actions";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Store, Warehouse } from "@/lib/types";

interface WarehousesManagerProps {
  stores: Store[];
  warehouses: Warehouse[];
}

export function WarehousesManager({ stores, warehouses }: WarehousesManagerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addNames, setAddNames] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  function addWarehouse(storeId: string) {
    const name = addNames[storeId]?.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createWarehouseAction({ storeId, name });
        setAddNames((current) => ({ ...current, [storeId]: "" }));
        router.refresh();
        toast.success(t("Warehouse created"));
      } catch {
        toast.error(t("Failed to create warehouse"));
      }
    });
  }

  function saveRename() {
    if (!editing || !editing.name.trim()) return;
    const { id, name } = editing;
    startTransition(async () => {
      try {
        await updateWarehouseAction(id, { name: name.trim() });
        setEditing(null);
        router.refresh();
        toast.success(t("Warehouse updated"));
      } catch {
        toast.error(t("Failed to update warehouse"));
      }
    });
  }

  function toggleActive(warehouse: Warehouse) {
    startTransition(async () => {
      try {
        await updateWarehouseAction(warehouse.id, { isActive: !warehouse.is_active });
        router.refresh();
        toast.success(t("Warehouse updated"));
      } catch {
        toast.error(t("Failed to update warehouse"));
      }
    });
  }

  function makeDefault(warehouse: Warehouse) {
    startTransition(async () => {
      try {
        await setDefaultWarehouseAction(warehouse.store_id, warehouse.id);
        router.refresh();
        toast.success(t("Default warehouse updated"));
      } catch {
        toast.error(t("Failed to update default warehouse"));
      }
    });
  }

  return (
    <>
      <PageHeader
        title={t("Warehouses")}
        description={t("Each branch has a default warehouse that POS sales deduct from. Add more warehouses for storage or production")}
      />

      <div className="grid gap-6">
        {stores.map((store) => {
          const storeWarehouses = warehouses.filter((w) => w.store_id === store.id);
          return (
            <OperationalCard key={store.id} title={store.name}>
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {storeWarehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <WarehouseIcon className="size-5 shrink-0 text-muted-foreground" />
                          {editing?.id === warehouse.id ? (
                            <Input
                              value={editing.name}
                              autoFocus
                              className="h-9"
                              onChange={(e) =>
                                setEditing({ id: warehouse.id, name: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename();
                                if (e.key === "Escape") setEditing(null);
                              }}
                            />
                          ) : (
                            <p className="truncate font-medium">{warehouse.name}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {warehouse.is_default ? (
                            <StatusPill variant="info" label={t("Default")} />
                          ) : null}
                          {!warehouse.is_active ? (
                            <StatusPill variant="danger" label={t("Disabled")} />
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2">
                        {editing?.id === warehouse.id ? (
                          <>
                            <Button size="sm" disabled={pending} onClick={saveRename}>
                              <Check className="size-3.5" />
                              {t("Save")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              <X className="size-3.5" />
                              {t("Cancel")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => setEditing({ id: warehouse.id, name: warehouse.name })}
                            >
                              <Pencil className="size-3.5" />
                              {t("Rename")}
                            </Button>
                            {!warehouse.is_default ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={pending || !warehouse.is_active}
                                  onClick={() => makeDefault(warehouse)}
                                >
                                  <Star className="size-3.5" />
                                  {t("Make default")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => toggleActive(warehouse)}
                                >
                                  {warehouse.is_active ? t("Disable") : t("Enable")}
                                </Button>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  className="flex max-w-md gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addWarehouse(store.id);
                  }}
                >
                  <Input
                    placeholder={t("Warehouse name, e.g. Cold storage")}
                    value={addNames[store.id] ?? ""}
                    onChange={(e) =>
                      setAddNames((current) => ({ ...current, [store.id]: e.target.value }))
                    }
                  />
                  <Button type="submit" disabled={pending || !(addNames[store.id]?.trim())}>
                    <Plus className="size-4" />
                    {t("Add warehouse")}
                  </Button>
                </form>
              </div>
            </OperationalCard>
          );
        })}
      </div>
    </>
  );
}
