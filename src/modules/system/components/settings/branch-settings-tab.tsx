"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import {
  createDeviceAction,
  createStoreAction,
  createWarehouseAction,
  deleteDeviceAction,
  generateDevicePairingCodeAction,
  setDefaultWarehouseAction,
  updateStoreAction,
  updateWarehouseAction,
  updateDeviceAction,
} from "@/modules/system/actions/system.actions";
import { registerBrowserDeviceAction } from "@/modules/auth/actions/device.actions";
import { getStoreMenuSlug } from "@/lib/online-menu-path";
import type { Store, Warehouse } from "@/lib/types";
import { QrMenuTools } from "@/modules/system/components/settings/qr-menu-tools";
import { PosSetupGuide } from "@/modules/system/components/settings/pos-setup-guide";

function storeEditDefaults(store: Store) {
  return {
    name: store.name,
    code: store.code,
    address: store.address,
    phone: store.phone,
    timezone: store.timezone ?? "",
    isActive: store.is_active,
    menuSlug: getStoreMenuSlug(store),
  };
}

interface BranchSettingsTabProps {
  stores: Store[];
  warehouses: Warehouse[];
  devices: {
    id: string;
    store_id: string;
    name: string;
    is_active: boolean;
    last_seen_at: string | null;
  }[];
}

export function BranchSettingsTab({ stores, warehouses, devices }: BranchSettingsTabProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [storeForm, setStoreForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    timezone: "",
  });
  const [storeEdits, setStoreEdits] = useState(
    Object.fromEntries(stores.map((s) => [s.id, storeEditDefaults(s)]))
  );
  const [warehouseEdits, setWarehouseEdits] = useState(
    Object.fromEntries(
      warehouses.map((w) => [w.id, { name: w.name, isActive: w.is_active }])
    )
  );
  const [warehouseAdds, setWarehouseAdds] = useState<Record<string, string>>({});
  const [deviceAdds, setDeviceAdds] = useState<Record<string, string>>({});
  const [deviceEdits, setDeviceEdits] = useState(
    Object.fromEntries(
      devices.map((d) => [d.id, { name: d.name, storeId: d.store_id }])
    )
  );
  const [deviceToDelete, setDeviceToDelete] = useState<string | null>(null);
  const [pairingCodes, setPairingCodes] = useState<Record<string, string>>({});

  function syncDeviceEdit(device: { id: string; name: string; store_id: string }) {
    setDeviceEdits((current) => ({
      ...current,
      [device.id]: { name: device.name, storeId: device.store_id },
    }));
  }

  function refreshSettings() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PosSetupGuide />

      <OperationalCard title="Stores">
        <div className="grid gap-6">
          {stores.map((store) => {
            const storeWarehouses = warehouses.filter((w) => w.store_id === store.id);
            const storeDevices = devices.filter((d) => d.store_id === store.id);

            return (
              <div
                key={store.id}
                className="grid gap-4 rounded-xl border border-border/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{store.name}</p>
                    <p className="text-xs text-muted-foreground">Branch · menu QR · warehouses · POS</p>
                  </div>
                  <QrCode className="size-5 shrink-0 text-muted-foreground" />
                </div>

                <QrMenuTools
                  store={store}
                  origin={origin}
                  menuSlug={storeEdits[store.id]?.menuSlug ?? getStoreMenuSlug(store)}
                />

                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Menu link name</Label>
                  <Input
                    value={storeEdits[store.id]?.menuSlug ?? getStoreMenuSlug(store)}
                    onChange={(e) =>
                      setStoreEdits({
                        ...storeEdits,
                        [store.id]: {
                          ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                          menuSlug: e.target.value,
                        },
                      })
                    }
                    placeholder="e.g. downtown or maadi"
                    className="text-xs"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Store name</Label>
                    <Input
                      value={storeEdits[store.id]?.name ?? store.name}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                            name: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Code</Label>
                    <Input
                      value={storeEdits[store.id]?.code ?? store.code}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                            code: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <Input
                      value={storeEdits[store.id]?.address ?? store.address}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                            address: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <Input
                      value={storeEdits[store.id]?.phone ?? store.phone}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                            phone: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Timezone</Label>
                    <Input
                      value={storeEdits[store.id]?.timezone ?? store.timezone ?? ""}
                      placeholder="Inherit org timezone if empty"
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                            timezone: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={storeEdits[store.id]?.isActive ?? store.is_active}
                    onCheckedChange={(v) =>
                      setStoreEdits({
                        ...storeEdits,
                        [store.id]: {
                          ...(storeEdits[store.id] ?? storeEditDefaults(store)),
                          isActive: v === true,
                        },
                      })
                    }
                  />
                  Active branch
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updateStoreAction(store.id, storeEdits[store.id]);
                        toast.success("Branch updated");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Failed to update branch"
                        );
                      }
                    });
                  }}
                >
                  Save branch
                </Button>

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-3 text-sm font-medium">Warehouses</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {storeWarehouses.map((warehouse) => (
                      <div
                        key={warehouse.id}
                        className="grid gap-2 rounded-lg border border-border/60 p-3"
                      >
                        <Input
                          value={warehouseEdits[warehouse.id]?.name ?? warehouse.name}
                          onChange={(e) =>
                            setWarehouseEdits({
                              ...warehouseEdits,
                              [warehouse.id]: {
                                ...(warehouseEdits[warehouse.id] ?? {
                                  name: warehouse.name,
                                  isActive: warehouse.is_active,
                                }),
                                name: e.target.value,
                              },
                            })
                          }
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={
                              warehouseEdits[warehouse.id]?.isActive ?? warehouse.is_active
                            }
                            disabled={warehouse.is_default}
                            onCheckedChange={(v) =>
                              setWarehouseEdits({
                                ...warehouseEdits,
                                [warehouse.id]: {
                                  ...(warehouseEdits[warehouse.id] ?? {
                                    name: warehouse.name,
                                    isActive: warehouse.is_active,
                                  }),
                                  isActive: v === true,
                                },
                              })
                            }
                          />
                          Active
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  await updateWarehouseAction(
                                    warehouse.id,
                                    warehouseEdits[warehouse.id]
                                  );
                                  toast.success("Warehouse updated");
                                } catch {
                                  toast.error("Failed to update warehouse");
                                }
                              });
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={warehouse.is_default ? "default" : "outline"}
                            disabled={
                              pending || warehouse.is_default || !warehouse.is_active
                            }
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  await setDefaultWarehouseAction(store.id, warehouse.id);
                                  toast.success("Default warehouse updated");
                                } catch {
                                  toast.error("Failed to update default warehouse");
                                }
                              });
                            }}
                          >
                            {warehouse.is_default ? "Default" : "Make default"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex max-w-md gap-2">
                    <Input
                      placeholder="Warehouse name"
                      value={warehouseAdds[store.id] ?? ""}
                      onChange={(e) =>
                        setWarehouseAdds({ ...warehouseAdds, [store.id]: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || !(warehouseAdds[store.id]?.trim())}
                      onClick={() => {
                        const name = warehouseAdds[store.id]?.trim();
                        if (!name) return;
                        startTransition(async () => {
                          try {
                            await createWarehouseAction({ storeId: store.id, name });
                            setWarehouseAdds({ ...warehouseAdds, [store.id]: "" });
                            toast.success("Warehouse created");
                          } catch {
                            toast.error("Failed to create warehouse");
                          }
                        });
                      }}
                    >
                      Add warehouse
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-3 text-sm font-medium">POS devices</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {storeDevices.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground md:col-span-2">
                        No devices registered for this branch yet. Add one below to generate a
                        pairing code.
                      </p>
                    ) : (
                      storeDevices.map((device) => (
                        <div
                          key={device.id}
                          className="grid gap-2 rounded-lg border border-border/60 p-3"
                        >
                          <Input
                            placeholder="Device name"
                            value={deviceEdits[device.id]?.name ?? device.name}
                            onChange={(e) =>
                              setDeviceEdits({
                                ...deviceEdits,
                                [device.id]: {
                                  ...(deviceEdits[device.id] ?? {
                                    name: device.name,
                                    storeId: device.store_id,
                                  }),
                                  name: e.target.value,
                                },
                              })
                            }
                          />
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={device.is_active}
                              onCheckedChange={(v) => {
                                startTransition(async () => {
                                  try {
                                    const updated = await updateDeviceAction(device.id, {
                                      isActive: v === true,
                                    });
                                    syncDeviceEdit(updated);
                                    refreshSettings();
                                    toast.success("Device updated");
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to update device"
                                    );
                                  }
                                });
                              }}
                            />
                            Active
                          </label>
                          {device.last_seen_at ? (
                            <p className="text-xs text-muted-foreground">
                              Last seen: {new Date(device.last_seen_at).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Not paired yet</p>
                          )}
                          {pairingCodes[device.id] ? (
                            <p className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest">
                              Code: {pairingCodes[device.id]} (15 min)
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  try {
                                    const updated = await updateDeviceAction(device.id, {
                                      name: deviceEdits[device.id]?.name,
                                      storeId: store.id,
                                    });
                                    syncDeviceEdit(updated);
                                    refreshSettings();
                                    toast.success("Device updated");
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to update device"
                                    );
                                  }
                                });
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  try {
                                    const { code } = await generateDevicePairingCodeAction(
                                      device.id
                                    );
                                    setPairingCodes({ ...pairingCodes, [device.id]: code });
                                    await navigator.clipboard.writeText(code);
                                    toast.success("Pairing code copied");
                                  } catch {
                                    toast.error("Failed to generate code");
                                  }
                                });
                              }}
                            >
                              Pairing code
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await registerBrowserDeviceAction(device.id);
                                  if (result.success) {
                                    refreshSettings();
                                    toast.success("This browser is registered");
                                  } else {
                                    toast.error(result.error ?? "Registration failed");
                                  }
                                });
                              }}
                            >
                              Register this browser
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => setDeviceToDelete(device.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex max-w-md gap-2">
                    <Input
                      placeholder="Register name"
                      value={deviceAdds[store.id] ?? ""}
                      onChange={(e) =>
                        setDeviceAdds({ ...deviceAdds, [store.id]: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || !(deviceAdds[store.id]?.trim())}
                      onClick={() => {
                        const name = deviceAdds[store.id]?.trim();
                        if (!name) return;
                        startTransition(async () => {
                          try {
                            const created = await createDeviceAction({
                              storeId: store.id,
                              name,
                            });
                            setDeviceAdds({ ...deviceAdds, [store.id]: "" });
                            syncDeviceEdit(created);
                            const { code } = await generateDevicePairingCodeAction(created.id);
                            setPairingCodes({ ...pairingCodes, [created.id]: code });
                            await navigator.clipboard.writeText(code);
                            refreshSettings();
                            toast.success("Device created — pairing code copied");
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "Failed to create device"
                            );
                          }
                        });
                      }}
                    >
                      Add device
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid max-w-xl gap-3 rounded-xl border border-dashed border-border/60 p-4">
            <p className="text-sm font-medium">Add branch</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Store name</Label>
                <Input
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={storeForm.code}
                  onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={storeForm.timezone}
                  onChange={(e) => setStoreForm({ ...storeForm, timezone: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A default warehouse named &quot;Main warehouse&quot; is created automatically.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !storeForm.name}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await createStoreAction(storeForm);
                    setStoreForm({ name: "", code: "", address: "", phone: "", timezone: "" });
                    toast.success("Branch created");
                  } catch {
                    toast.error("Failed to create branch");
                  }
                });
              }}
            >
              Add branch
            </Button>
          </div>
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={deviceToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDeviceToDelete(null);
        }}
        title="Delete this device?"
        description="This action cannot be undone."
        confirmLabel="Delete device"
        destructive
        onConfirm={async () => {
          if (!deviceToDelete) return;
          try {
            await deleteDeviceAction(deviceToDelete);
            setDeviceToDelete(null);
            setDeviceEdits((current) => {
              const next = { ...current };
              delete next[deviceToDelete];
              return next;
            });
            refreshSettings();
            toast.success("Device deleted");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete device");
          }
        }}
      />
    </div>
  );
}
