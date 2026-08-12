"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OperationalCard } from "@/components/Velora/operational-card";
import {
  createStoreAction,
  createWarehouseAction,
  setDefaultWarehouseAction,
  uploadStoreLogoAction,
  updateStoreAction,
  updateWarehouseAction,
} from "@/modules/system/actions/system.actions";
import type { Store, Warehouse } from "@/lib/types";
import type { BusinessActivityType } from "@/lib/constants";
import { PosSetupGuide } from "@/modules/system/components/settings/pos-setup-guide";
import { BranchQrDownloadCard } from "@/modules/system/components/settings/branch-qr-download-card";
import { MenuViewStatsCard } from "@/modules/online-menu/components/menu-view-stats-card";
import { appendOnlineMenuSourceParam } from "@/modules/online-menu/lib/online-menu-view-source";
import type { OnlineMenuViewStats } from "@/modules/online-menu/services/online-menu-views.service";
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
import {
  MENU_THEMES,
  parseOnlineMenuTheme,
  type MenuThemeSlug,
} from "@/modules/online-menu/lib/menu-themes";
import {
  formatMenuThemePriceEgp,
  type MenuThemeAccessRow,
} from "@/modules/online-menu/lib/menu-theme-commerce";
import { firstGrapheme } from "@/lib/first-grapheme";

const ADD_STORE_TAB = "__new__";

type StoreSection = "details" | "online" | "warehouses";

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
    isActive: store.is_active,
    onlineMenuEnabled: store.settings.online_menu_enabled === true,
    onlineMenuOrderingEnabled: store.settings.online_menu_ordering_enabled === true,
    onlineMenuSlug: getOnlineMenuSlug(store),
    onlineMenuUnlisted: store.settings.online_menu_unlisted === true,
    onlineMenuTheme: parseOnlineMenuTheme(store.settings as Record<string, unknown>),
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
  activityType?: BusinessActivityType;
  menuThemeRows: MenuThemeAccessRow[];
  menuViewStatsByStore?: Record<string, OnlineMenuViewStats>;
}

export function BranchSettingsTab({
  stores,
  warehouses,
  activityType,
  menuThemeRows,
  menuViewStatsByStore = {},
}: BranchSettingsTabProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [storeForm, setStoreForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
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
  const [selectedStoreId, setSelectedStoreId] = useState(
    () => stores[0]?.id ?? ADD_STORE_TAB
  );
  const [storeSection, setStoreSection] = useState<StoreSection>("details");

  useEffect(() => {
    if (selectedStoreId === ADD_STORE_TAB) return;
    if (!stores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(stores[0]?.id ?? ADD_STORE_TAB);
      setStoreSection("details");
    }
  }, [stores, selectedStoreId]);

  function refreshSettings() {
    router.refresh();
  }

  function saveStore(store: Store, edit: ReturnType<typeof storeEditDefaults>) {
    startTransition(async () => {
      try {
        await updateStoreAction(store.id, {
          name: edit.name,
          code: edit.code,
          address: edit.address,
          phone: edit.phone,
          isActive: edit.isActive,
          onlineMenu: {
            enabled: edit.onlineMenuEnabled,
            orderingEnabled: edit.onlineMenuOrderingEnabled,
            slug: edit.onlineMenuSlug,
            unlisted: edit.onlineMenuUnlisted,
            theme: edit.onlineMenuTheme,
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
        toast.error(error instanceof Error ? error.message : "فشل تحديث الفرع");
      }
    });
  }

  return (
    <div className="space-y-6">
      <PosSetupGuide activityType={activityType} />

      <OperationalCard title="الفروع">
        <Tabs
          value={selectedStoreId}
          onValueChange={(value) => {
            setSelectedStoreId(value ?? ADD_STORE_TAB);
            setStoreSection("details");
          }}
          className="gap-4"
        >
          <div className="min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList
              variant="line"
              className="flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 px-0"
            >
              {stores.map((store) => (
                <TabsTrigger
                  key={store.id}
                  value={store.id}
                  title={store.name}
                  className="h-9 max-w-[12rem] shrink-0 px-3"
                >
                  <span className="truncate">{store.name}</span>
                </TabsTrigger>
              ))}
              <TabsTrigger value={ADD_STORE_TAB} className="h-9 shrink-0 px-3">
                إضافة فرع
              </TabsTrigger>
            </TabsList>
          </div>

          {stores.map((store) => {
            const storeWarehouses = warehouses.filter((w) => w.store_id === store.id);
            const edit = storeEdits[store.id] ?? storeEditDefaults(store);
            const onlineMenuSlug = edit.onlineMenuSlug;
            const onlineMenuToken = getOnlineMenuToken(store);
            const onlineMenuHref = buildOnlineMenuHref(
              onlineMenuSlug,
              edit.onlineMenuUnlisted,
              onlineMenuToken
            );
            const onlineMenuLinkHref = onlineMenuHref
              ? appendOnlineMenuSourceParam(onlineMenuHref, "link")
              : "";
            const onlineMenuQrHref = onlineMenuHref
              ? appendOnlineMenuSourceParam(onlineMenuHref, "qr")
              : "";
            const logoUrl = storeLogoUrls[store.id] ?? getOnlineMenuLogoUrl(store);
            const menuViewStats = menuViewStatsByStore[store.id];

            return (
              <TabsContent key={store.id} value={store.id} className="mt-0">
                <div className="grid gap-[var(--mds-space-4)] rounded-[var(--mds-radius-lg)] border border-border/60 p-[var(--mds-space-4)]">
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
                          {firstGrapheme(store.name, "?")}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{store.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {storeWarehouses.length} مخزن
                        </p>
                      </div>
                    </div>
                    {onlineMenuHref && edit.onlineMenuEnabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        nativeButton={false}
                        render={<a href={onlineMenuLinkHref || onlineMenuHref} target="_blank" rel="noopener noreferrer" />}
                      >
                        فتح منيو الأونلاين
                      </Button>
                    ) : null}
                  </div>

                  <Tabs
                    value={storeSection}
                    onValueChange={(value) => {
                      setStoreSection((value as StoreSection) ?? "details");
                    }}
                    className="gap-4"
                  >
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-3">
                      <TabsTrigger value="details" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
                        بيانات الفرع
                      </TabsTrigger>
                      <TabsTrigger value="online" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
                        منيو الأونلاين
                      </TabsTrigger>
                      <TabsTrigger value="warehouses" className="h-9 px-2 text-xs sm:px-3 sm:text-sm">
                        المخازن
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="mt-0 grid gap-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-2">
                          <Label
                            htmlFor={`store-logo-${store.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            لوجو الفرع للمنيو
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              id={`store-logo-${store.id}`}
                              type="file"
                              accept="image/*"
                              disabled={pending}
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                startTransition(async () => {
                                  try {
                                    const formData = new FormData();
                                    formData.set("logo", file);
                                    const url = await uploadStoreLogoAction(store.id, formData);
                                    setStoreLogoUrls((current) => ({
                                      ...current,
                                      [store.id]: url,
                                    }));
                                    toast.success("تم رفع لوجو الفرع");
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "فشل رفع لوجو الفرع"
                                    );
                                  } finally {
                                    event.target.value = "";
                                  }
                                });
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                document.getElementById(`store-logo-${store.id}`)?.click()
                              }
                            >
                              {pending ? "جاري الرفع..." : logoUrl ? "تغيير اللوجو" : "اختر صورة"}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {logoUrl ? "لوجو مرفوع" : "لم يتم اختيار ملف"}
                            </span>
                          </div>
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
                                [store.id]: { ...edit, name: e.target.value },
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
                                [store.id]: { ...edit, code: e.target.value },
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
                                [store.id]: { ...edit, address: e.target.value },
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
                                [store.id]: { ...edit, phone: e.target.value },
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
                              [store.id]: { ...edit, isActive: v === true },
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
                        onClick={() => saveStore(store, edit)}
                      >
                        حفظ الفرع
                      </Button>
                    </TabsContent>

                    <TabsContent value="online" className="mt-0 grid gap-4">
                      {onlineMenuHref && edit.onlineMenuEnabled ? (
                        <div className="grid gap-3">
                          <p className="break-words rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                            {edit.onlineMenuUnlisted
                              ? "رابط المنيو غير المُدرج: "
                              : "رابط المنيو العام: "}
                            <span className="font-mono text-foreground break-all">
                              {onlineMenuLinkHref || onlineMenuHref}
                            </span>
                          </p>
                          {menuViewStats ? <MenuViewStatsCard stats={menuViewStats} /> : null}
                          {!edit.onlineMenuUnlisted ? (
                            <BranchQrDownloadCard
                              storeName={store.name}
                              storeCode={store.code}
                              address={store.address}
                              phone={store.phone}
                              onlineMenuHref={onlineMenuQrHref || onlineMenuHref}
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              المنيو غير مُدرج — الوصول يحتاج التوكن في الرابط. رمز QR العام معطّل في
                              هذا الوضع.
                            </p>
                          )}
                        </div>
                      ) : null}

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
                          <Label className="text-xs text-muted-foreground">
                            رابط الفرع (slug) — للمنيو والكاشير
                          </Label>
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
                          {edit.onlineMenuSlug.trim() ? (
                            <p className="break-words rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                              رابط الكاشير:{" "}
                              <span className="font-mono text-foreground break-all" dir="ltr">
                                /{edit.onlineMenuSlug.trim().toLowerCase()}/pos
                              </span>
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            يجب أن يكون فريدًا على مستوى النظام بالكامل.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">مظهر المنيو</Label>
                            <p className="text-[11px] text-muted-foreground">
                              الثيمات المتاحة حسب تفعيل المنصة. غير المفعّل يظهر للمعاينة فقط.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {(menuThemeRows.length
                              ? menuThemeRows
                              : Object.values(MENU_THEMES).map((theme) => ({
                                  slug: theme.slug,
                                  nameAr: theme.nameAr,
                                  descriptionAr: theme.descriptionAr,
                                  priceEgp: 0,
                                  globallyAvailable: true,
                                  enabledForOrg: true,
                                  notes: "",
                                }))
                            ).map((row) => {
                              const theme = MENU_THEMES[row.slug];
                              const selected = edit.onlineMenuTheme === row.slug;
                              const canSelect = row.enabledForOrg;
                              const previewHref = onlineMenuHref
                                ? `${onlineMenuHref}${onlineMenuHref.includes("?") ? "&" : "?"}theme=${row.slug}`
                                : "";
                              return (
                                <button
                                  key={row.slug}
                                  type="button"
                                  disabled={!canSelect}
                                  onClick={() => {
                                    if (!canSelect) return;
                                    setStoreEdits({
                                      ...storeEdits,
                                      [store.id]: {
                                        ...edit,
                                        onlineMenuTheme: row.slug as MenuThemeSlug,
                                      },
                                    });
                                  }}
                                  className={[
                                    "rounded-xl border p-3 text-start transition",
                                    selected
                                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                                      : "border-border/60 bg-background",
                                    canSelect
                                      ? "hover:border-primary/40"
                                      : "cursor-not-allowed opacity-60",
                                  ].join(" ")}
                                >
                                  <div
                                    className="mb-2 flex h-10 overflow-hidden rounded-lg border border-black/5"
                                    aria-hidden
                                  >
                                    <span
                                      className="w-1/2"
                                      style={{ background: theme.previewColors.background }}
                                    />
                                    <span
                                      className="w-1/4"
                                      style={{ background: theme.previewColors.primary }}
                                    />
                                    <span
                                      className="w-1/4"
                                      style={{ background: theme.previewColors.accent }}
                                    />
                                  </div>
                                  <p className="text-sm font-medium">{theme.nameAr}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {theme.descriptionAr}
                                  </p>
                                  <p className="mt-1 text-xs font-medium text-foreground/80">
                                    {canSelect
                                      ? formatMenuThemePriceEgp(row.priceEgp)
                                      : `غير مفعّل · ${formatMenuThemePriceEgp(row.priceEgp)}`}
                                  </p>
                                  {previewHref ? (
                                    <a
                                      href={previewHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      معاينة
                                    </a>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
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
                                        theme: edit.onlineMenuTheme,
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
                                      error instanceof Error
                                        ? error.message
                                        : "فشل تجديد التوكن"
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
                                تُحفظ في إعدادات الفرع. بدون تفعيل الجدول يبقى الطلب متاحاً طالما
                                السماح بالطلب مفعّل.
                              </p>
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={edit.orderingHoursEnforce}
                                onCheckedChange={(v) =>
                                  setStoreEdits({
                                    ...storeEdits,
                                    [store.id]: {
                                      ...edit,
                                      orderingHoursEnforce: v === true,
                                    },
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
                                  className="grid gap-2 rounded-md border border-border/40 bg-background/80 p-2 md:grid-cols-[7rem_auto_minmax(0,1fr)_minmax(0,1fr)]"
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
                                            windows: [
                                              { open: window.open, close: window.close },
                                            ],
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
                                  <span className="self-center text-xs text-muted-foreground">
                                    {closed ? "مغلق" : "مفتوح"}
                                  </span>
                                  <Input
                                    type="time"
                                    dir="ltr"
                                    disabled={closed}
                                    value={window.open}
                                    onChange={(e) => {
                                      const nextDay: DayHours = {
                                        windows: [
                                          { open: e.target.value, close: window.close },
                                        ],
                                      };
                                      setStoreEdits({
                                        ...storeEdits,
                                        [store.id]: {
                                          ...edit,
                                          orderingHours: {
                                            ...edit.orderingHours,
                                            days: {
                                              ...edit.orderingHours.days,
                                              [dayKey]: nextDay,
                                            },
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
                                        windows: [
                                          { open: window.open, close: e.target.value },
                                        ],
                                      };
                                      setStoreEdits({
                                        ...storeEdits,
                                        [store.id]: {
                                          ...edit,
                                          orderingHours: {
                                            ...edit.orderingHours,
                                            days: {
                                              ...edit.orderingHours.days,
                                              [dayKey]: nextDay,
                                            },
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
                            التوقيت وفق توقيت مصر (القاهرة). الفترات الليلية (مثل 22:00→02:00)
                            مدعومة.
                          </p>
                        </div>

                        <div className="grid gap-3 rounded-md border border-border/50 bg-muted/20 p-3">
                          <div>
                            <p className="text-sm font-medium">الاستلام والتوصيل</p>
                            <p className="text-xs text-muted-foreground">
                              إعدادات first-party فقط (بدون منصات خارجية). الرسوم تُحسب من السيرفر
                              حسب المنطقة.
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
                                <p className="text-xs font-medium text-muted-foreground">
                                  مناطق التوصيل والرسوم
                                </p>
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
                                    className="grid gap-2 rounded-md border border-border/40 bg-background/80 p-2 md:grid-cols-[minmax(0,1fr)_minmax(5.5rem,7.5rem)_auto]"
                                  >
                                    <Input
                                      value={zone.name}
                                      placeholder="اسم المنطقة (مثال: المعادي)"
                                      onChange={(e) => {
                                        const zones = edit.fulfillment.zones.map(
                                          (candidate, i) =>
                                            i === index
                                              ? { ...candidate, name: e.target.value }
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
                                        const zones = edit.fulfillment.zones.map(
                                          (candidate, i) =>
                                            i === index
                                              ? {
                                                  ...candidate,
                                                  fee: Number.isFinite(fee) ? fee : 0,
                                                }
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
                                        const zones = edit.fulfillment.zones.filter(
                                          (_, i) => i !== index
                                        );
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
                        onClick={() => saveStore(store, edit)}
                      >
                        حفظ إعدادات المنيو
                      </Button>
                    </TabsContent>

                    <TabsContent value="warehouses" className="mt-0 grid gap-4">
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
                      <div className="flex max-w-md flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder="اسم المخزن"
                          value={warehouseAdds[store.id] ?? ""}
                          onChange={(e) =>
                            setWarehouseAdds({
                              ...warehouseAdds,
                              [store.id]: e.target.value,
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={pending || !warehouseAdds[store.id]?.trim()}
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
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            );
          })}

          <TabsContent value={ADD_STORE_TAB} className="mt-0">
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
                      setStoreForm({
                        name: "",
                        code: "",
                        address: "",
                        phone: "",
                      });
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
          </TabsContent>
        </Tabs>
      </OperationalCard>
    </div>
  );
}
