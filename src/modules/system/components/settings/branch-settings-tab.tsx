"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  uploadStoreLogoAction,
  updateStoreAction,
  updateWarehouseAction,
  updateDeviceAction,
} from "@/modules/system/actions/system.actions";
import { registerBrowserDeviceAction } from "@/modules/auth/actions/device.actions";
import type { Store, Warehouse } from "@/lib/types";
import { PosSetupGuide } from "@/modules/system/components/settings/pos-setup-guide";

function storeEditDefaults(store: Store) {
  return {
    name: store.name,
    code: store.code,
    address: store.address,
    phone: store.phone,
    timezone: store.timezone ?? "",
    isActive: store.is_active,
  };
}

function getOnlineMenuSlug(store: Store): string {
  const slug = store.settings.online_menu_slug;
  return typeof slug === "string" ? slug : "";
}

function getOnlineMenuLogoUrl(store: Store): string {
  const logoUrl = store.settings.online_menu_logo_url;
  return typeof logoUrl === "string" ? logoUrl : "";
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
  const [storeLogoUrls, setStoreLogoUrls] = useState(
    Object.fromEntries(stores.map((s) => [s.id, getOnlineMenuLogoUrl(s)]))
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

      <OperationalCard title="الفروع">
        <div className="grid gap-6">
          {stores.map((store) => {
            const storeWarehouses = warehouses.filter((w) => w.store_id === store.id);
            const storeDevices = devices.filter((d) => d.store_id === store.id);
            const onlineMenuSlug = getOnlineMenuSlug(store);
            const onlineMenuHref = onlineMenuSlug ? `/menu/${onlineMenuSlug}` : "";
            const logoUrl = storeLogoUrls[store.id] ?? getOnlineMenuLogoUrl(store);

            return (
              <div
                key={store.id}
                className="grid gap-4 rounded-xl border border-border/60 p-4"
              >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={`لوجو ${store.name}`}
                        className="size-12 shrink-0 rounded-2xl border border-border/60 object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                        {store.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{store.name}</p>
                      <p className="text-xs text-muted-foreground">فرع · مخازن · أجهزة كاشير</p>
                    </div>
                  </div>
                  {onlineMenuHref ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      nativeButton={false}
                      render={<a href={onlineMenuHref} target="_blank" rel="noopener noreferrer" />}
                    >
                      فتح منيو الأونلاين
                    </Button>
                  ) : null}
                </div>
                {onlineMenuHref ? (
                  <p className="break-words rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                    رابط المنيو العام:{" "}
                    <span className="font-mono text-foreground break-all">{onlineMenuHref}</span>
                  </p>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">لوجو الفرع للمنيو</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={pending}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        startTransition(async () => {
                          try {
                            const formData = new FormData();
                            formData.set("logo", file);
                            const url = await uploadStoreLogoAction(store.id, formData);
                            setStoreLogoUrls((current) => ({ ...current, [store.id]: url }));
                            toast.success("تم رفع لوجو الفرع");
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "فشل رفع لوجو الفرع");
                          } finally {
                            event.target.value = "";
                          }
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      سيظهر هذا اللوجو في رأس منيو الأونلاين لهذا الفرع بدل لوجو المتجر العام.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">اسم الفرع</Label>
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
                    <Label className="text-xs text-muted-foreground">الكود</Label>
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
                    <Label className="text-xs text-muted-foreground">العنوان</Label>
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
                    <Label className="text-xs text-muted-foreground">الهاتف</Label>
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
                    <Label className="text-xs text-muted-foreground">المنطقة الزمنية</Label>
                    <Input
                      value={storeEdits[store.id]?.timezone ?? store.timezone ?? ""}
                      placeholder="استخدم منطقة المؤسسة لو تركته فارغًا"
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
                  فرع نشط
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-fit"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updateStoreAction(store.id, storeEdits[store.id]);
                        toast.success("تم تحديث الفرع");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "فشل تحديث الفرع"
                        );
                      }
                    });
                  }}
                >
                  حفظ الفرع
                </Button>

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-3 text-sm font-medium">المخازن</p>
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
                          نشط
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
                                  toast.success("تم تحديث المخزن");
                                } catch {
                                  toast.error("فشل تحديث المخزن");
                                }
                              });
                            }}
                          >
                            حفظ
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
                                  toast.success("تم تحديث المخزن الافتراضي");
                                } catch {
                                  toast.error("فشل تحديث المخزن الافتراضي");
                                }
                              });
                            }}
                          >
                            {warehouse.is_default ? "افتراضي" : "اجعله افتراضي"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex max-w-md flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="اسم المخزن"
                      value={warehouseAdds[store.id] ?? ""}
                      onChange={(e) =>
                        setWarehouseAdds({ ...warehouseAdds, [store.id]: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={pending || !(warehouseAdds[store.id]?.trim())}
                      onClick={() => {
                        const name = warehouseAdds[store.id]?.trim();
                        if (!name) return;
                        startTransition(async () => {
                          try {
                            await createWarehouseAction({ storeId: store.id, name });
                            setWarehouseAdds({ ...warehouseAdds, [store.id]: "" });
                            toast.success("تم إنشاء المخزن");
                          } catch {
                            toast.error("فشل إنشاء المخزن");
                          }
                        });
                      }}
                    >
                      إضافة مخزن
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-3 text-sm font-medium">أجهزة الكاشير</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {storeDevices.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground md:col-span-2">
                        لا توجد أجهزة مسجلة لهذا الفرع بعد. أضف جهازًا بالأسفل لإنشاء كود اقتران.
                      </p>
                    ) : (
                      storeDevices.map((device) => (
                        <div
                          key={device.id}
                          className="grid gap-2 rounded-lg border border-border/60 p-3"
                        >
                          <Input
                            placeholder="اسم الجهاز"
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
                                    toast.success("تم تحديث الجهاز");
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "فشل تحديث الجهاز"
                                    );
                                  }
                                });
                              }}
                            />
                            نشط
                          </label>
                          {device.last_seen_at ? (
                            <p className="text-xs text-muted-foreground">
                              آخر ظهور: {new Date(device.last_seen_at).toLocaleString()}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">لم يتم الاقتران بعد</p>
                          )}
                          {pairingCodes[device.id] ? (
                            <p className="break-words rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest">
                              الكود: {pairingCodes[device.id]} (15 دقيقة)
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
                                    toast.success("تم تحديث الجهاز");
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "فشل تحديث الجهاز"
                                    );
                                  }
                                });
                              }}
                            >
                              حفظ
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
                                    toast.success("تم نسخ كود الاقتران");
                                  } catch {
                                    toast.error("فشل إنشاء الكود");
                                  }
                                });
                              }}
                            >
                              كود الاقتران
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
                                    toast.success("تم تسجيل هذا المتصفح");
                                  } else {
                                    toast.error(result.error ?? "فشل التسجيل");
                                  }
                                });
                              }}
                            >
                              تسجيل هذا المتصفح
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() => setDeviceToDelete(device.id)}
                            >
                              حذف
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex max-w-md flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="اسم جهاز الكاشير"
                      value={deviceAdds[store.id] ?? ""}
                      onChange={(e) =>
                        setDeviceAdds({ ...deviceAdds, [store.id]: e.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
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
                            toast.success("تم إنشاء الجهاز ونسخ كود الاقتران");
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "فشل إنشاء الجهاز"
                            );
                          }
                        });
                      }}
                    >
                      إضافة جهاز
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid max-w-xl gap-3 rounded-xl border border-dashed border-border/60 p-4">
            <p className="text-sm font-medium">إضافة فرع</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>اسم الفرع</Label>
                <Input
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الكود</Label>
                <Input
                  value={storeForm.code}
                  onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                  placeholder="يتم إنشاؤه تلقائيًا لو تُرك فارغًا"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>العنوان</Label>
                <Input
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>المنطقة الزمنية</Label>
                <Input
                  value={storeForm.timezone}
                  onChange={(e) => setStoreForm({ ...storeForm, timezone: e.target.value })}
                  placeholder="اختياري"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              سيتم إنشاء مخزن افتراضي باسم &quot;المخزن الرئيسي&quot; تلقائيًا.
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
                    toast.success("تم إنشاء الفرع");
                  } catch {
                    toast.error("فشل إنشاء الفرع");
                  }
                });
              }}
            >
              إضافة فرع
            </Button>
          </div>
        </div>
      </OperationalCard>

      <ConfirmActionDialog
        open={deviceToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDeviceToDelete(null);
        }}
        title="حذف هذا الجهاز؟"
        description="لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف الجهاز"
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
            toast.success("تم حذف الجهاز");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "فشل حذف الجهاز");
          }
        }}
      />
    </div>
  );
}
