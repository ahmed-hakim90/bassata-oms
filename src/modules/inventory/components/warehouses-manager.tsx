"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Power, Star, Warehouse as WarehouseIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
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
                      <div className="mt-auto">
                        {editing?.id === warehouse.id ? (
                          <CompactActions className="justify-start">
                            <CompactAction
                              label={t("Save")}
                              icon={Check}
                              variant="default"
                              disabled={pending}
                              onClick={saveRename}
                            />
                            <CompactAction
                              label={t("Cancel")}
                              icon={X}
                              variant="ghost"
                              onClick={() => setEditing(null)}
                            />
                          </CompactActions>
                        ) : (
                          <CompactActions className="justify-start">
                            <CompactAction
                              label={t("Rename")}
                              icon={Pencil}
                              disabled={pending}
                              onClick={() => setEditing({ id: warehouse.id, name: warehouse.name })}
                            />
                            {!warehouse.is_default ? (
                              <>
                                <CompactAction
                                  label={t("Make default")}
                                  icon={Star}
                                  disabled={pending || !warehouse.is_active}
                                  onClick={() => makeDefault(warehouse)}
                                />
                                <CompactAction
                                  label={warehouse.is_active ? t("Disable") : t("Enable")}
                                  icon={Power}
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => toggleActive(warehouse)}
                                />
                              </>
                            ) : null}
                          </CompactActions>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  className="flex w-full max-w-md flex-row items-center gap-2"
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
                    className="min-h-11 min-w-0 flex-1"
                  />
                  <CompactAction
                    label={t("Add warehouse")}
                    icon={Plus}
                    variant="default"
                    type="submit"
                    disabled={pending || !(addNames[store.id]?.trim())}
                  />
                </form>
              </div>
            </OperationalCard>
          );
        })}
      </div>
    </>
  );
}
