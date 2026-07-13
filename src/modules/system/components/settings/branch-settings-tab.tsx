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
import { BranchQrDownloadCard } from "@/modules/system/components/settings/branch-qr-download-card";
import {
  WEEKDAY_KEYS,
  WEEKDAY_LABELS_AR,
  defaultOnlineOrderingHoursConfig,
  parseOnlineOrderingHours,
  type DayHours,
  type OnlineOrderingHoursConfig,
} from "@/modules/online-menu/lib/online-ordering-hours";
import {
  defaultOnlineFulfillmentConfig,
  parseOnlineFulfillment,
  type OnlineDeliveryZone,
  type OnlineFulfillmentConfig,
} from "@/modules/online-menu/lib/online-fulfillment";

function storeEditDefaults(store: Store) {
  const hours = parseOnlineOrderingHours(store.settings);
  const seededHours =
    Object.keys(hours.days).length > 0 ? hours : defaultOnlineOrderingHoursConfig();
  const fulfillment = parseOnlineFulfillment(store.settings);
  return {
    name: store.name,
    code: store.code,
    address: store.address,
    phone: store.phone,
    timezone: store.timezone ?? "",
    isActive: store.is_active,
    onlineMenuEnabled: store.settings.online_menu_enabled === true,
    onlineMenuOrderingEnabled: store.settings.online_menu_ordering_enabled === true,
    onlineMenuSlug: getOnlineMenuSlug(store),
    onlineMenuUnlisted: store.settings.online_menu_unlisted === true,
    onlineOrderingPaused: store.settings.online_ordering_paused === true,
    orderingHoursEnforce: hours.enforce,
    orderingHours: seededHours,
    fulfillment:
      fulfillment.zones.length > 0 || fulfillment.deliveryEnabled
        ? fulfillment
        : defaultOnlineFulfillmentConfig(),
  };
}

function getOnlineMenuSlug(store: Store): string {
  const slug = store.settings.online_menu_slug;
  return typeof slug === "string" ? slug : "";
}

function getOnlineMenuToken(store: Store): string {
  const token = store.settings.online_menu_token;
  return typeof token === "string" ? token : "";
}

function getOnlineMenuLogoUrl(store: Store): string {
  const logoUrl = store.settings.online_menu_logo_url;
  return typeof logoUrl === "string" ? logoUrl : "";
}

function buildOnlineMenuHref(slug: string, unlisted: boolean, token: string): string {
  if (!slug) return "";
  if (unlisted && token) return `/menu/${slug}?token=${encodeURIComponent(token)}`;
  return `/menu/${slug}`;
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
        <div className="grid gap-[var(--mds-space-6)]">
          {stores.map((store) => {
            const storeWarehouses = warehouses.filter((w) => w.store_id === store.id);
            const storeDevices = devices.filter((d) => d.store_id === store.id);
            const edit = storeEdits[store.id] ?? storeEditDefaults(store);
            const onlineMenuSlug = edit.onlineMenuSlug;
            const onlineMenuToken = getOnlineMenuToken(store);
            const onlineMenuHref = buildOnlineMenuHref(
              onlineMenuSlug,
              edit.onlineMenuUnlisted,
              onlineMenuToken
            );
            const logoUrl = storeLogoUrls[store.id] ?? getOnlineMenuLogoUrl(store);

            return (
              <div
                key={store.id}
                className="grid gap-[var(--mds-space-4)] rounded-[var(--mds-radius-lg)] border border-border/60 p-[var(--mds-space-4)]"
              >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={`لوجو ${store.name}`}
                        className="size-12 shrink-0 rounded-[var(--mds-radius-lg)] border border-border/60 object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--mds-radius-lg)] bg-primary/10 text-lg font-semibold text-primary">
                        {store.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{store.name}</p>
                      <p className="text-xs text-muted-foreground">فرع · مخازن · أجهزة كاشير</p>
                    </div>
                  </div>
                  {onlineMenuHref && edit.onlineMenuEnabled ? (
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
                {onlineMenuHref && edit.onlineMenuEnabled ? (
                  <div className="grid gap-3">
                    <p className="break-words rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                      {edit.onlineMenuUnlisted ? "رابط المنيو غير المُدرج: " : "رابط المنيو العام: "}
                      <span className="font-mono text-foreground break-all">{onlineMenuHref}</span>
                    </p>
                    {!edit.onlineMenuUnlisted ? (
                      <BranchQrDownloadCard
                        storeName={store.name}
                        storeCode={store.code}
                        address={store.address}
                        phone={store.phone}
                        onlineMenuHref={onlineMenuHref}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        المنيو غير مُدرج — الوصول يحتاج التوكن في الرابط. رمز QR العام معطّل في هذا الوضع.
                      </p>
                    )}
                  </div>
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
                      value={edit.name}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...edit,
                            name: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">الكود</Label>
                    <Input
                      value={edit.code}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...edit,
                            code: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">العنوان</Label>
                    <Input
                      value={edit.address}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...edit,
                            address: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">الهاتف</Label>
                    <Input
                      value={edit.phone}
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...edit,
                            phone: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">المنطقة الزمنية</Label>
                    <Input
                      value={edit.timezone}
                      placeholder="استخدم منطقة المؤسسة لو تركته فارغًا"
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: {
                            ...edit,
                            timezone: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={edit.isActive}
                    onCheckedChange={(v) =>
                      setStoreEdits({
                        ...storeEdits,
                        [store.id]: {
                          ...edit,
                          isActive: v === true,
                        },
                      })
                    }
                  />
                  فرع نشط
                </label>

                <div className="grid gap-3 rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-medium">منيو الأونلاين</p>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={edit.onlineMenuEnabled}
                      onCheckedChange={(v) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: { ...edit, onlineMenuEnabled: v === true },
                        })
                      }
                    />
                    تفعيل المنيو العام
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={edit.onlineMenuOrderingEnabled}
                      onCheckedChange={(v) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: { ...edit, onlineMenuOrderingEnabled: v === true },
                        })
                      }
                    />
                    السماح بالطلب من المنيو
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={edit.onlineOrderingPaused}
                      onCheckedChange={(v) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: { ...edit, onlineOrderingPaused: v === true },
                        })
                      }
                    />
                    إيقاف استقبال الطلبات مؤقتاً
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={edit.onlineMenuUnlisted}
                      onCheckedChange={(v) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: { ...edit, onlineMenuUnlisted: v === true },
                        })
                      }
                    />
                    غير مُدرج (يحتاج توكن في الرابط)
                  </label>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">رابط المنيو (slug)</Label>
                    <Input
                      value={edit.onlineMenuSlug}
                      dir="ltr"
                      className="font-mono text-sm"
                      onChange={(e) =>
                        setStoreEdits({
                          ...storeEdits,
                          [store.id]: { ...edit, onlineMenuSlug: e.target.value },
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      يجب أن يكون فريدًا على مستوى النظام بالكامل.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">توكن الوصول</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={onlineMenuToken || "—"}
                        readOnly
                        dir="ltr"
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              await updateStoreAction(store.id, {
                                onlineMenu: {
                                  enabled: edit.onlineMenuEnabled,
                                  orderingEnabled: edit.onlineMenuOrderingEnabled,
                                  slug: edit.onlineMenuSlug,
                                  unlisted: edit.onlineMenuUnlisted,
                                  orderingPaused: edit.onlineOrderingPaused,
                                  orderingHours: {
                                    ...edit.orderingHours,
                                    enforce: edit.orderingHoursEnforce,
                                  },
                                  regenerateToken: true,
                                },
                              });
                              refreshSettings();
                              toast.success("تم تجديد توكن المنيو");
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "فشل تجديد التوكن"
                              );
                            }
                          });
                        }}
                      >
                        تجديد التوكن
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">ساعات الطلب الأونلاين</p>
                        <p className="text-xs text-muted-foreground">
                          تُحفظ في إعدادات الفرع. بدون تفعيل الجدول يبقى الطلب متاحاً طالما السماح
                          بالطلب مفعّل.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={edit.orderingHoursEnforce}
                          onCheckedChange={(v) =>
                            setStoreEdits({
                              ...storeEdits,
                              [store.id]: { ...edit, orderingHoursEnforce: v === true },
                            })
                          }
                        />
                        فرض ساعات العمل
                      </label>
                    </div>
                    <div className="grid gap-2">
                      {WEEKDAY_KEYS.map((dayKey) => {
                        const day = edit.orderingHours.days[dayKey];
                        const closed = day?.closed === true;
                        const window =
                          !closed && day && "windows" in day && day.windows[0]
                            ? day.windows[0]
                            : { open: "10:00", close: "23:00" };
                        return (
                          <div
                            key={dayKey}
                            className="grid gap-2 rounded-md border border-border/40 bg-background/80 p-2 sm:grid-cols-[110px_auto_1fr_1fr]"
                          >
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={!closed}
                                onCheckedChange={(v) => {
                                  const nextDays: OnlineOrderingHoursConfig["days"] = {
                                    ...edit.orderingHours.days,
                                  };
                                  if (v === true) {
                                    nextDays[dayKey] = {
                                      windows: [{ open: window.open, close: window.close }],
                                    };
                                  } else {
                                    nextDays[dayKey] = { closed: true };
                                  }
                                  setStoreEdits({
                                    ...storeEdits,
                                    [store.id]: {
                                      ...edit,
                                      orderingHours: {
                                        ...edit.orderingHours,
                                        days: nextDays,
                                      },
                                    },
                                  });
                                }}
                              />
                              {WEEKDAY_LABELS_AR[dayKey]}
                            </label>
                            <span className="text-xs text-muted-foreground self-center">
                              {closed ? "مغلق" : "مفتوح"}
                            </span>
                            <Input
                              type="time"
                              dir="ltr"
                              disabled={closed}
                              value={window.open}
                              onChange={(e) => {
                                const nextDay: DayHours = {
                                  windows: [{ open: e.target.value, close: window.close }],
                                };
                                setStoreEdits({
                                  ...storeEdits,
                                  [store.id]: {
                                    ...edit,
                                    orderingHours: {
                                      ...edit.orderingHours,
                                      days: { ...edit.orderingHours.days, [dayKey]: nextDay },
                                    },
                                  },
                                });
                              }}
                              className="h-9"
                              aria-label={`فتح ${WEEKDAY_LABELS_AR[dayKey]}`}
                            />
                            <Input
                              type="time"
                              dir="ltr"
                              disabled={closed}
                              value={window.close}
                              onChange={(e) => {
                                const nextDay: DayHours = {
                                  windows: [{ open: window.open, close: e.target.value }],
                                };
                                setStoreEdits({
                                  ...storeEdits,
                                  [store.id]: {
                                    ...edit,
                                    orderingHours: {
                                      ...edit.orderingHours,
                                      days: { ...edit.orderingHours.days, [dayKey]: nextDay },
                                    },
                                  },
                                });
                              }}
                              className="h-9"
                              aria-label={`إغلاق ${WEEKDAY_LABELS_AR[dayKey]}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      التوقيت وفق منطقة الفرع الزمنية
                      {edit.timezone ? ` (${edit.timezone})` : " (أو منطقة المؤسسة / القاهرة)"}.
                      الفترات الليلية (مثل 22:00→02:00) مدعومة.
                    </p>
                  </div>

                  <div className="grid gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
                    <div>
                      <p className="text-sm font-medium">الاستلام والتوصيل</p>
                      <p className="text-xs text-muted-foreground">
                        إعدادات first-party فقط (بدون منصات خارجية). الرسوم تُحسب من السيرفر حسب المنطقة.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={edit.fulfillment.pickupEnabled}
                          onCheckedChange={(v) =>
                            setStoreEdits({
                              ...storeEdits,
                              [store.id]: {
                                ...edit,
                                fulfillment: {
                                  ...edit.fulfillment,
                                  pickupEnabled: v === true,
                                },
                              },
                            })
                          }
                        />
                        استلام من الفرع
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={edit.fulfillment.deliveryEnabled}
                          onCheckedChange={(v) =>
                            setStoreEdits({
                              ...storeEdits,
                              [store.id]: {
                                ...edit,
                                fulfillment: {
                                  ...edit.fulfillment,
                                  deliveryEnabled: v === true,
                                },
                              },
                            })
                          }
                        />
                        توصيل
                      </label>
                    </div>
                    {edit.fulfillment.deliveryEnabled ? (
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">مناطق التوصيل والرسوم</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const nextZone: OnlineDeliveryZone = {
                                id: crypto.randomUUID().replaceAll("-", "").slice(0, 12),
                                name: "",
                                fee: 0,
                              };
                              setStoreEdits({
                                ...storeEdits,
                                [store.id]: {
                                  ...edit,
                                  fulfillment: {
                                    ...edit.fulfillment,
                                    zones: [...edit.fulfillment.zones, nextZone],
                                  },
                                },
                              });
                            }}
                          >
                            إضافة منطقة
                          </Button>
                        </div>
                        {edit.fulfillment.zones.length === 0 ? (
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            أضف منطقة واحدة على الأقل قبل تفعيل التوصيل.
                          </p>
                        ) : (
                          edit.fulfillment.zones.map((zone, index) => (
                            <div
                              key={zone.id}
                              className="grid gap-2 rounded-md border border-border/40 bg-background/80 p-2 sm:grid-cols-[1fr_120px_auto]"
                            >
                              <Input
                                value={zone.name}
                                placeholder="اسم المنطقة (مثال: المعادي)"
                                onChange={(e) => {
                                  const zones = edit.fulfillment.zones.map((candidate, i) =>
                                    i === index ? { ...candidate, name: e.target.value } : candidate
                                  );
                                  setStoreEdits({
                                    ...storeEdits,
                                    [store.id]: {
                                      ...edit,
                                      fulfillment: { ...edit.fulfillment, zones },
                                    },
                                  });
                                }}
                              />
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                dir="ltr"
                                value={zone.fee}
                                placeholder="الرسوم"
                                aria-label="رسوم التوصيل"
                                onChange={(e) => {
                                  const fee = Number(e.target.value);
                                  const zones = edit.fulfillment.zones.map((candidate, i) =>
                                    i === index
                                      ? { ...candidate, fee: Number.isFinite(fee) ? fee : 0 }
                                      : candidate
                                  );
                                  setStoreEdits({
                                    ...storeEdits,
                                    [store.id]: {
                                      ...edit,
                                      fulfillment: { ...edit.fulfillment, zones },
                                    },
                                  });
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => {
                                  const zones = edit.fulfillment.zones.filter((_, i) => i !== index);
                                  setStoreEdits({
                                    ...storeEdits,
                                    [store.id]: {
                                      ...edit,
                                      fulfillment: { ...edit.fulfillment, zones },
                                    },
                                  });
                                }}
                              >
                                حذف
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-fit"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await updateStoreAction(store.id, {
                          name: edit.name,
                          code: edit.code,
                          address: edit.address,
                          phone: edit.phone,
                          timezone: edit.timezone,
                          isActive: edit.isActive,
                          onlineMenu: {
                            enabled: edit.onlineMenuEnabled,
                            orderingEnabled: edit.onlineMenuOrderingEnabled,
                            slug: edit.onlineMenuSlug,
                            unlisted: edit.onlineMenuUnlisted,
                            orderingPaused: edit.onlineOrderingPaused,
                            orderingHours: {
                              ...edit.orderingHours,
                              enforce: edit.orderingHoursEnforce,
                            },
                            fulfillment: edit.fulfillment as OnlineFulfillmentConfig,
                          },
                        });
                        toast.success("تم تحديث الفرع");
                        refreshSettings();
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

          <div className="grid max-w-xl gap-[var(--mds-space-3)] rounded-[var(--mds-radius-lg)] border border-dashed border-border/60 p-[var(--mds-space-4)]">
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
