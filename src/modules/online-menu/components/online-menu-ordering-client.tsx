"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Gift, Minus, Phone, Plus, Search, ShoppingBag, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { firstGrapheme } from "@/lib/first-grapheme";
import { submitPublicOnlineOrderAction } from "@/modules/online-orders/actions/public-online-order.actions";
import { getMenuTheme } from "@/modules/online-menu/lib/menu-themes";
import type { OnlineMenuData, OnlineMenuItem, OnlineMenuVariant } from "@/modules/online-menu/services/online-menu.service";
import { formatCurrency } from "@/lib/format";
import { resolveDisplayPriceRange } from "@/modules/products/lib/display-price-range";

type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  unitPrice: number;
  quantity: number;
};

type Group = {
  id: string;
  name: string;
  color: string;
  icon: string;
  items: OnlineMenuItem[];
};

type CustomerForm = {
  name: string;
  phone: string;
  notes: string;
};

type FulfillmentForm = {
  type: "pickup" | "delivery";
  zoneId: string;
  address: string;
};

function lineId(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

function getMenuItemDisplayPrice(item: OnlineMenuItem, currency: string) {
  const variantPrices = item.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price));
  const hasVariantPrice = variantPrices.length > 0;
  const { amount, rangeLabel } = resolveDisplayPriceRange({
    variantPrices,
    baseAmount: item.price,
    currency,
    rangeSeparator: "arabic",
  });
  const min = [...variantPrices].sort((a, b) => a - b)[0];
  const max = [...variantPrices].sort((a, b) => a - b).at(-1);

  return {
    label: hasVariantPrice
      ? max != null && min != null && max > min
        ? "من أقل سعر"
        : "سعر الأحجام"
      : null,
    amount,
    range: rangeLabel,
  };
}

const DEFAULT_CATEGORY_COLOR = "#94A3B8";

function isImageIcon(icon: string) {
  return icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/");
}

function CategoryMark({ group, size = "sm" }: { group: Group; size?: "sm" | "lg" }) {
  const color = group.color || DEFAULT_CATEGORY_COLOR;
  const markSize = size === "lg" ? "size-14 rounded-2xl text-xl" : "size-6 rounded-full text-xs";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden font-semibold text-white shadow-sm ${markSize}`}
      style={{ backgroundColor: color }}
    >
      {isImageIcon(group.icon) ? (
        <Image
          src={group.icon}
          alt=""
          fill
          sizes={size === "lg" ? "56px" : "24px"}
          unoptimized
          className="object-cover"
        />
      ) : (
        firstGrapheme(group.name)
      )}
    </span>
  );
}

interface OnlineMenuOrderingClientProps {
  slug: string;
  token?: string;
  menu: OnlineMenuData;
}

export function OnlineMenuOrderingClient({ slug, token, menu }: OnlineMenuOrderingClientProps) {
  const theme = getMenuTheme(menu.store.theme);
  const isListLayout = theme.layout === "list";
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>({ name: "", phone: "", notes: "" });
  const [couponCode, setCouponCode] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentForm>(() => {
    const config = menu.store.fulfillment;
    const defaultType =
      config.pickupEnabled ? "pickup" : config.deliveryEnabled ? "delivery" : "pickup";
    return {
      type: defaultType,
      zoneId: config.zones[0]?.id ?? "",
      address: "",
    };
  });
  const [lastOrder, setLastOrder] = useState<{
    id: string;
    trackingPath: string;
  } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerPrompt, setCustomerPrompt] = useState<string | null>(null);
  const [recentlyAddedLineId, setRecentlyAddedLineId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fulfillmentConfig = menu.store.fulfillment;

  const groups = useMemo<Group[]>(() => {
    const uncategorized = menu.items.filter((item) => !item.categoryId);
    const categories = menu.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color || DEFAULT_CATEGORY_COLOR,
        icon: category.icon,
        items: menu.items.filter((item) => item.categoryId === category.id),
      }))
      .filter((category) => category.items.length > 0);
    return uncategorized.length > 0
      ? [
          ...categories,
          {
            id: "other",
            name: "أصناف أخرى",
            color: DEFAULT_CATEGORY_COLOR,
            icon: "",
            items: uncategorized,
          },
        ]
      : categories;
  }, [menu.categories, menu.items]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleGroups = useMemo<Group[]>(() => {
    if (!normalizedSearchQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const searchableText = [
            item.name,
            item.description,
            ...item.variants.map((variant) => variant.name),
          ]
            .join(" ")
            .toLowerCase();
          return searchableText.includes(normalizedSearchQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedSearchQuery]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const cartItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedZone = fulfillmentConfig.zones.find((zone) => zone.id === fulfillment.zoneId);
  const deliveryFee =
    fulfillment.type === "delivery" && selectedZone ? selectedZone.fee : 0;
  const orderTotal = subtotal + deliveryFee;

  useEffect(() => {
    if (!recentlyAddedLineId) return;
    const timeoutId = window.setTimeout(() => setRecentlyAddedLineId(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [recentlyAddedLineId]);

  function addToCart(item: OnlineMenuItem, variant: OnlineMenuVariant | null = null) {
    if (!menu.store.canOrder) return;
    const id = lineId(item.id, variant?.id ?? null);
    const unitPrice = variant?.price ?? item.price;
    setLastOrder(null);
    setRecentlyAddedLineId(id);
    setCart((current) => {
      const existing = current.find((line) => line.id === id);
      if (existing) {
        return current.map((line) =>
          line.id === id
            ? { ...line, quantity: Math.min(99, line.quantity + 1) }
            : line
        );
      }
      return [
        ...current,
        {
          id,
          productId: item.id,
          variantId: variant?.id ?? null,
          name: item.name,
          variantName: variant?.name ?? null,
          unitPrice,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.id !== id)
        : current.map((line) => (line.id === id ? { ...line, quantity: Math.min(99, quantity) } : line))
    );
  }

  function submitOrder(options: { allowNameOnly?: boolean } = {}) {
    if (!menu.store.canOrder) return;
    const customerName = customer.name.trim();
    const customerPhone = customer.phone.trim();
    if (customerPhone && customerPhone.length < 5) {
      setCustomerPrompt("رقم الهاتف قصير. اكتبه بشكل صحيح أو امسحه وكمل بالاسم فقط.");
      setIsCustomerDialogOpen(true);
      return;
    }
    if (!customerName) {
      setCustomerPrompt("اكتب اسمك على الأقل علشان نجهز الطلب باسمك ونتجنب أي لخبطة.");
      setIsCustomerDialogOpen(true);
      return;
    }
    if (!customerPhone && !options.allowNameOnly) {
      setCustomerPrompt("تقدر تكمل بالاسم فقط، ولو أضفت رقم الهاتف هنقدر نأكد الطلب ونسجلك كعميل.");
      setIsCustomerDialogOpen(true);
      return;
    }

    if (!fulfillmentConfig.pickupEnabled && !fulfillmentConfig.deliveryEnabled) {
      toast.error("طرق الاستلام غير مُعدّة لهذا الفرع");
      return;
    }
    if (fulfillment.type === "pickup" && !fulfillmentConfig.pickupEnabled) {
      toast.error("الاستلام من الفرع غير متاح");
      return;
    }
    if (fulfillment.type === "delivery") {
      if (!fulfillmentConfig.deliveryEnabled) {
        toast.error("التوصيل غير متاح");
        return;
      }
      if (!fulfillment.zoneId) {
        toast.error("اختر منطقة التوصيل");
        return;
      }
      if (fulfillment.address.trim().length < 5) {
        toast.error("اكتب عنوان التوصيل (٥ أحرف على الأقل)");
        return;
      }
    }

    setCustomerPrompt(null);
    startTransition(async () => {
      try {
        const result = await submitPublicOnlineOrderAction({
          slug,
          token,
          customerName,
          customerPhone,
          notes: customer.notes,
          fulfillmentType: fulfillment.type,
          zoneId: fulfillment.type === "delivery" ? fulfillment.zoneId : null,
          deliveryAddress: fulfillment.type === "delivery" ? fulfillment.address : null,
          couponCode: couponCode.trim() || null,
          lines: cart.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        setCart([]);
        setCustomer({ name: "", phone: "", notes: "" });
        setCouponCode("");
        setFulfillment((current) => ({ ...current, address: "" }));
        setLastOrder({ id: result.id, trackingPath: result.trackingPath });
        setIsCartOpen(false);
        toast.success("شكراً لك، تم إرسال طلبك بنجاح");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر إرسال الطلب");
      }
    });
  }

  const isPremiumList = theme.slug === "antika" || theme.slug === "soul";
  const chipInactiveClass =
    theme.slug === "antika"
      ? "h-10 shrink-0 rounded-full border border-[#d7c7b2] bg-[#fffaf1] px-3 text-[#2a160f] hover:bg-[#f0dfc4]"
      : theme.slug === "soul"
        ? "h-10 shrink-0 rounded-full border border-[#d4af37]/25 bg-[#252018] px-3 text-[#f5f0e8] hover:bg-[#2a2520]"
        : theme.slug === "bistro"
          ? "h-10 shrink-0 rounded-full border border-[#c9a84c]/25 bg-[#1c1915] px-3 text-[#f5f0e8] hover:bg-[#252018]"
          : "h-10 shrink-0 rounded-full border bg-card/90 px-3";

  return (
    <div id="online-menu-items" className="pb-28" data-menu-layout={theme.layout} data-menu-theme={theme.slug}>
      <section
        className={[
          "sticky top-2 z-20 mb-5 border p-3 backdrop-blur",
          isPremiumList ? "rounded-none bg-card/95" : "rounded-3xl border-border/50 bg-card/98",
          theme.slug === "antika"
            ? "border-[#d7c7b2]"
            : theme.slug === "soul"
              ? "border-[#3d3528]"
              : theme.slug === "bistro"
                ? "border-[#3d3528]"
                : "border-border/50",
        ].join(" ")}
        style={{ boxShadow: "var(--mds-elevation-2)" }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ابحث في المنيو..."
            className="h-11 rounded-2xl bg-background/80 ps-10"
            aria-label="البحث في المنيو"
          />
        </div>

        {groups.length > 0 ? (
          <div className="-mx-3 mt-3 overflow-x-auto px-3 pb-1 scrollbar-none">
            <div className="flex w-max gap-2">
              <Button
                nativeButton={false}
                variant="default"
                size="sm"
                className="h-9 shrink-0 rounded-full px-4"
                render={<a href="#online-menu-items" />}
              >
                الكل
              </Button>
              {visibleGroups.map((group) => (
                <Button
                  key={group.id}
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  className={chipInactiveClass}
                  style={
                    isPremiumList || theme.slug === "bistro"
                      ? undefined
                      : {
                          borderColor: `${group.color}40`,
                          background: `linear-gradient(135deg, ${group.color}18, transparent)`,
                        }
                  }
                  render={<a href={`#menu-category-${group.id}`} />}
                >
                  <CategoryMark group={group} />
                  {group.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {lastOrder ? (
        <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
          <p className="font-semibold">شكراً لك، استلمنا طلبك بنجاح.</p>
          <p className="mt-1 text-sm">
            رقم المتابعة: <span className="font-mono">{lastOrder.id.slice(0, 8)}</span>. تابع حالة
            طلبك من الرابط الآمن.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            nativeButton={false}
            render={<a href={lastOrder.trackingPath} />}
          >
            تتبع الطلب
          </Button>
        </section>
      ) : null}

      <div className="space-y-6">
        {groups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            لا توجد أصناف متاحة في المنيو حالياً.
          </section>
        ) : visibleGroups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            لا توجد نتائج مطابقة لـ <span className="font-medium">{searchQuery}</span>.
          </section>
        ) : (
          visibleGroups.map((group) => {
            const useThemedCategory =
              theme.slug === "antika" || theme.slug === "soul";
            const categoryBlockClass = useThemedCategory
              ? theme.slug === "antika"
                ? "antika-category-block space-y-2"
                : "soul-category-block space-y-2"
              : "space-y-3";
            const headingClass = useThemedCategory
              ? theme.slug === "antika"
                ? "antika-category-heading"
                : "soul-category-heading"
              : "flex items-center justify-between gap-3 rounded-3xl border border-border/40 bg-card/80 p-3";
            const titleClass = useThemedCategory
              ? theme.slug === "antika"
                ? "antika-section-title"
                : "soul-section-title"
              : "";
            const rowClass =
              theme.slug === "antika"
                ? "antika-product-row"
                : theme.slug === "soul"
                  ? "soul-product-row"
                  : theme.slug === "minimal"
                    ? "minimal-product-row"
                    : "";
            const priceClass =
              theme.slug === "antika"
                ? "antika-price"
                : theme.slug === "soul"
                  ? "soul-price"
                  : "";

            return (
            <section
              id={`menu-category-${group.id}`}
              key={group.id}
              className={`scroll-mt-28 ${categoryBlockClass}`}
            >
              <div
                className={headingClass}
                style={
                  useThemedCategory
                    ? undefined
                    : {
                        borderColor: `${group.color}30`,
                        background: `linear-gradient(135deg, ${group.color}1a, color-mix(in srgb, var(--card) 90%, transparent))`,
                        boxShadow: "var(--mds-elevation-1)",
                      }
                }
              >
                {useThemedCategory ? (
                  <h2 className={titleClass}>
                    <span>{group.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {group.items.length} صنف
                    </span>
                  </h2>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryMark group={group} size="lg" />
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold">{group.name}</h2>
                        <p className="text-sm text-muted-foreground">{group.items.length} صنف</p>
                      </div>
                    </div>
                    {normalizedSearchQuery ? (
                      <Badge variant="outline">{group.items.length} نتيجة</Badge>
                    ) : null}
                  </>
                )}
              </div>

              {isListLayout ? (
                <div className="space-y-0">
                  {group.items.map((item) => {
                    const displayPrice = getMenuItemDisplayPrice(
                      item,
                      menu.organization.currency
                    );
                    const isPremiumRow = theme.slug === "antika" || theme.slug === "soul";
                    const showThumb = theme.showImages;
                    const thumbBorder =
                      theme.slug === "antika"
                        ? "border border-[#d7c7b2] bg-[#fffaf1]"
                        : theme.slug === "soul"
                          ? "border border-[#3d3528] bg-[#252018]"
                          : "rounded-xl bg-primary/10";
                    const leaderClass =
                      theme.slug === "antika"
                        ? "h-px min-w-8 flex-1 bg-[#2a160f]/35 transition-colors group-hover:bg-[#b67b31]"
                        : theme.slug === "soul"
                          ? "h-px min-w-8 flex-1 bg-[#d4af37]/25 transition-colors group-hover:bg-[#d4af37]"
                          : "h-px min-w-8 flex-1 bg-border";
                    const addBtnClass =
                      theme.slug === "antika"
                        ? "h-8 w-8 rounded-full bg-[#2a160f] p-0 text-[#f5eee3] hover:bg-[#b67b31]"
                        : theme.slug === "soul"
                          ? "h-8 w-8 rounded-full bg-[#d4af37] p-0 text-[#1c1915] hover:bg-[#e0c25a]"
                          : "h-8 w-8 rounded-full p-0";
                    const justAdded = recentlyAddedLineId === lineId(item.id, null);

                    return (
                      <article
                        key={item.id}
                        className={`group ${rowClass || "flex items-center gap-3 border-b border-border/50 py-3"}`}
                      >
                        {showThumb ? (
                          <div
                            className={`relative h-14 w-14 shrink-0 overflow-hidden sm:h-16 sm:w-16 ${thumbBorder}`}
                          >
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                fill
                                sizes="64px"
                                unoptimized
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <span className="flex size-full items-center justify-center text-lg font-bold text-primary/40">
                                {firstGrapheme(item.name)}
                              </span>
                            )}
                          </div>
                        ) : null}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold sm:text-base">
                                {item.name}
                                {item.isPopular ? (
                                  <span className="ms-2 text-xs font-normal text-primary">★</span>
                                ) : null}
                              </p>
                              {item.description ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                            {isPremiumRow ? <div className={leaderClass} /> : null}
                            <span
                              className={`shrink-0 text-base tabular-nums ${priceClass} ${
                                theme.slug === "antika"
                                  ? "text-[#b67b31]"
                                  : theme.slug === "soul"
                                    ? "text-[#d4af37]"
                                    : "font-bold text-primary"
                              }`}
                            >
                              {formatCurrency(displayPrice.amount, menu.organization.currency)}
                            </span>
                          </div>

                          {item.variants.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.variants.map((variant) => {
                                const variantLineId = lineId(item.id, variant.id);
                                const wasJustAdded = recentlyAddedLineId === variantLineId;
                                return (
                                  <Button
                                    key={variant.id}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-full px-2.5 text-xs"
                                    data-added={wasJustAdded}
                                    disabled={!menu.store.canOrder}
                                    onClick={() => addToCart(item, variant)}
                                  >
                                    {variant.name} ·{" "}
                                    {formatCurrency(variant.price, menu.organization.currency)}
                                    {wasJustAdded ? (
                                      <Check className="size-3.5" />
                                    ) : (
                                      <Plus className="size-3.5" />
                                    )}
                                  </Button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        {item.variants.length === 0 && menu.store.canOrder ? (
                          <Button
                            type="button"
                            size="sm"
                            className={addBtnClass}
                            onClick={() => addToCart(item)}
                            aria-label="أضف للسلة"
                          >
                            {justAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
                          </Button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
                {group.items.map((item) => {
                  const displayPrice = getMenuItemDisplayPrice(
                    item,
                    menu.organization.currency
                  );

                  return (
                    <article
                      key={item.id}
                      className="group flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-card transition hover:-translate-y-0.5"
                      style={{ boxShadow: "var(--mds-elevation-1)" }}
                    >
                      {theme.showImages ? (
                      <div className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden bg-primary/10">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            sizes="(min-width: 1024px) 33vw, 50vw"
                            unoptimized
                            className="object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-5xl font-bold text-primary/30 sm:text-6xl">
                            {firstGrapheme(item.name)}
                          </span>
                        )}
                        {item.imageUrl ? (
                          <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                        ) : null}
                        {item.isPopular ? (
                          <Badge variant="secondary" className="absolute start-2 top-2 rounded-full bg-background/90 shadow-sm backdrop-blur">
                            الأكثر طلباً
                          </Badge>
                        ) : null}
                      </div>
                      ) : null}

                      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-4">
                        <div className="grid gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{item.name}</h3>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-sm">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="w-fit rounded-2xl bg-primary/10 px-2.5 py-2 text-start sm:px-3">
                            {displayPrice.label ? (
                              <p className="text-xs text-primary/80">{displayPrice.label}</p>
                            ) : null}
                            <p className="text-sm font-bold tabular-nums text-primary sm:text-base">
                              {formatCurrency(displayPrice.amount, menu.organization.currency)}
                              {displayPrice.range ? (
                                <span className="ms-1 text-[11px] font-normal text-muted-foreground sm:text-xs">
                                  {displayPrice.range}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        {item.variants.length > 0 ? (
                          <div className="mt-auto grid gap-2">
                            <p className="text-xs font-medium text-muted-foreground">اختر الحجم</p>
                            {item.variants.map((variant) => {
                              const variantLineId = lineId(item.id, variant.id);
                              const wasJustAdded = recentlyAddedLineId === variantLineId;

                              return (
                                <Button
                                  key={variant.id}
                                  type="button"
                                  variant="outline"
                                  className="h-auto flex-col items-stretch gap-2 rounded-2xl border-border/40 bg-background/60 px-2 py-2 text-start hover:border-primary/40 hover:bg-primary/5 data-[added=true]:border-primary/50 data-[added=true]:bg-primary/10 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2.5"
                                  data-added={wasJustAdded}
                                  disabled={!menu.store.canOrder}
                                  onClick={() => addToCart(item, variant)}
                                >
                                  <span className="min-w-0 truncate font-medium">{variant.name}</span>
                                  <span className="flex shrink-0 items-center justify-between gap-1.5 sm:justify-end sm:gap-2">
                                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold tabular-nums sm:px-2.5 sm:text-xs">
                                      {formatCurrency(variant.price, menu.organization.currency)}
                                    </span>
                                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground sm:px-2.5">
                                      {wasJustAdded ? (
                                        <>
                                          <Check className="size-3.5" />
                                          تمت
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="size-3.5" />
                                          أضف
                                        </>
                                      )}
                                    </span>
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        ) : (
                          <Button
                            type="button"
                            className="mt-auto h-10 w-full rounded-2xl text-sm font-semibold sm:h-11 sm:text-base"
                            disabled={!menu.store.canOrder}
                            onClick={() => addToCart(item)}
                          >
                            {recentlyAddedLineId === lineId(item.id, null) ? (
                              <>
                                <Check className="size-4" />
                                تمت الإضافة
                              </>
                            ) : (
                              <>
                                <Plus className="size-4" />
                                إضافة للطلب
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              )}
            </section>
            );
          })
        )}
      </div>

      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="bottom-0 top-auto left-1/2 flex max-h-[90vh] max-w-none translate-y-0 flex-col overflow-hidden rounded-b-none rounded-t-3xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/40 px-5 pb-4 pt-3">
            <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-muted-foreground/25" />
            <DialogTitle className="flex items-center justify-between gap-3 pe-8">
              <span className="flex items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShoppingBag className="size-5" />
                </span>
                <span>
                  <span className="block">طلبك</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    راجع الأصناف قبل إرسال الطلب
                  </span>
                </span>
              </span>
              <Badge variant="outline" className="rounded-full">
                {cartItemCount} قطعة
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-background text-primary">
                  <ShoppingBag className="size-6" />
                </div>
                <p className="text-sm font-medium">السلة فارغة</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  اختر منتجات من الكروت لإضافتها للطلب.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li key={line.id} className="rounded-3xl border border-border/40 bg-muted/25 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{line.name}</p>
                        {line.variantName ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{line.variantName}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(line.unitPrice, menu.organization.currency)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="size-8 rounded-xl text-muted-foreground hover:text-destructive"
                        onClick={() => updateQuantity(line.id, 0)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-2xl border border-border/40 bg-background p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-8 rounded-xl"
                          onClick={() => updateQuantity(line.id, line.quantity - 1)}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-9 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-8 rounded-xl"
                          onClick={() => updateQuantity(line.id, line.quantity + 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <p className="shrink-0 text-base font-bold tabular-nums text-primary">
                        {formatCurrency(line.unitPrice * line.quantity, menu.organization.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-border/40 bg-card p-4">
            <div className="rounded-3xl bg-primary/10 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-primary/80">
                <span>الإجمالي</span>
                <span>{cartItemCount} قطعة</span>
              </div>
              <div className="mt-2 grid gap-1 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>مجموع الأصناف</span>
                  <span className="tabular-nums">
                    {formatCurrency(subtotal, menu.organization.currency)}
                  </span>
                </div>
                {deliveryFee > 0 ? (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>رسوم التوصيل</span>
                    <span className="tabular-nums">
                      {formatCurrency(deliveryFee, menu.organization.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="mt-1 flex items-end justify-between gap-3 border-t border-primary/15 pt-2">
                  <span className="text-sm text-muted-foreground">الإجمالي النهائي</span>
                  <span className="text-xl font-bold tabular-nums text-primary">
                    {formatCurrency(orderTotal, menu.organization.currency)}
                  </span>
                </div>
              </div>
            </div>

            {menu.store.canOrder ? (
              <>
                {(fulfillmentConfig.pickupEnabled || fulfillmentConfig.deliveryEnabled) && (
                  <div className="grid gap-2 rounded-3xl border border-border/50 p-3">
                    <p className="text-sm font-semibold">طريقة الاستلام</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {fulfillmentConfig.pickupEnabled ? (
                        <Button
                          type="button"
                          variant={fulfillment.type === "pickup" ? "default" : "outline"}
                          className="h-11 rounded-2xl"
                          onClick={() => setFulfillment((current) => ({ ...current, type: "pickup" }))}
                        >
                          استلام من الفرع
                        </Button>
                      ) : null}
                      {fulfillmentConfig.deliveryEnabled ? (
                        <Button
                          type="button"
                          variant={fulfillment.type === "delivery" ? "default" : "outline"}
                          className="h-11 rounded-2xl"
                          onClick={() =>
                            setFulfillment((current) => ({
                              ...current,
                              type: "delivery",
                              zoneId: current.zoneId || fulfillmentConfig.zones[0]?.id || "",
                            }))
                          }
                        >
                          توصيل
                        </Button>
                      ) : null}
                    </div>
                    {fulfillment.type === "delivery" ? (
                      <div className="grid gap-2 pt-1">
                        <label className="grid gap-1 text-sm">
                          <span className="text-muted-foreground">منطقة التوصيل</span>
                          <select
                            className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
                            value={fulfillment.zoneId}
                            onChange={(event) =>
                              setFulfillment((current) => ({
                                ...current,
                                zoneId: event.target.value,
                              }))
                            }
                            aria-label="منطقة التوصيل"
                          >
                            {fulfillmentConfig.zones.map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name} — {formatCurrency(zone.fee, menu.organization.currency)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Textarea
                          value={fulfillment.address}
                          onChange={(event) =>
                            setFulfillment((current) => ({
                              ...current,
                              address: event.target.value,
                            }))
                          }
                          placeholder="عنوان التوصيل بالتفصيل"
                          className="min-h-20 rounded-2xl"
                          aria-label="عنوان التوصيل"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="rounded-3xl border border-primary/15 bg-primary/5 px-4 py-3">
                  <p className="text-sm font-semibold">بيانات بسيطة لتأكيد الطلب</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    الاسم ورقم الهاتف يساعدونا نجهز الطلب باسمك ونتواصل معك بسرعة لو فيه أي تعديل.
                  </p>
                  {customerPrompt ? (
                    <p className="mt-2 rounded-2xl bg-background/80 px-3 py-2 text-xs font-medium text-primary">
                      {customerPrompt}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Input
                    value={customer.name}
                    onChange={(event) => {
                      setCustomer((current) => ({ ...current, name: event.target.value }));
                      setCustomerPrompt(null);
                    }}
                    placeholder="الاسم"
                    aria-invalid={customerPrompt !== null && !customer.name.trim()}
                    className="h-11 rounded-2xl"
                  />
                  <Input
                    value={customer.phone}
                    onChange={(event) => {
                      setCustomer((current) => ({ ...current, phone: event.target.value }));
                      setCustomerPrompt(null);
                    }}
                    placeholder="رقم الهاتف"
                    inputMode="tel"
                    aria-invalid={customerPrompt !== null && Boolean(customer.phone.trim()) && customer.phone.trim().length < 5}
                    className="h-11 rounded-2xl"
                  />
                  <Input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="كود خصم (اختياري)"
                    className="h-11 rounded-2xl uppercase"
                    autoCapitalize="characters"
                  />
                  <Textarea
                    value={customer.notes}
                    onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="ملاحظات الطلب"
                    className="min-h-20 rounded-2xl"
                  />
                </div>
                <Button
                  type="button"
                  className="h-12 w-full rounded-2xl text-base font-semibold"
                  disabled={isPending || cart.length === 0}
                  onClick={() => submitOrder()}
                >
                  {isPending ? "جاري الإرسال..." : "إرسال الطلب"}
                </Button>
                {lastOrder ? (
                  <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">
                    تم إرسال الطلب.{" "}
                    <a href={lastOrder.trackingPath} className="underline underline-offset-2">
                      تتبع الطلب
                    </a>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="rounded-2xl bg-amber-50 p-3 text-center text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
                {menu.store.availability.messageAr}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>كمّل بياناتك علشان نخدمك أسرع</DialogTitle>
            <DialogDescription>
              الاسم يكفي لإرسال الطلب، وإضافة رقم الهاتف تساعدنا نأكد الطلب ونسجل نقاطك عند إتمامه.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2 rounded-3xl bg-primary/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Gift className="size-4 text-primary" />
                مميزات إدخال البيانات
              </p>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  نجهز الطلب باسمك ونقلل احتمالية تبديل الطلبات.
                </p>
                <p className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  لو كتبت رقم الهاتف نقدر نأكد الطلب أو نبلغك بأي تعديل.
                </p>
                <p className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  الاسم والرقم يسجلوك كعميل تلقائيًا لتسهيل الطلبات القادمة.
                </p>
                <p className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  رقم الهاتف يساعدنا نضيف لك نقاط الولاء بعد إتمام الطلب.
                </p>
              </div>
            </div>

            {customerPrompt ? (
              <p className="rounded-2xl bg-muted/60 px-3 py-2 text-sm font-medium text-primary">
                {customerPrompt}
              </p>
            ) : null}

            <div className="grid gap-2">
              <div className="relative">
                <UserRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customer.name}
                  onChange={(event) => {
                    setCustomer((current) => ({ ...current, name: event.target.value }));
                    setCustomerPrompt(null);
                  }}
                  placeholder="اسمك"
                  aria-invalid={customerPrompt !== null && !customer.name.trim()}
                  className="h-11 rounded-2xl ps-10"
                />
              </div>
              <div className="relative">
                <Phone className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customer.phone}
                  onChange={(event) => {
                    setCustomer((current) => ({ ...current, phone: event.target.value }));
                    setCustomerPrompt(null);
                  }}
                  placeholder="رقم الهاتف اختياري"
                  inputMode="tel"
                  aria-invalid={customerPrompt !== null && Boolean(customer.phone.trim()) && customer.phone.trim().length < 5}
                  className="h-11 rounded-2xl ps-10"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl"
                disabled={isPending || !customer.name.trim()}
                onClick={() => {
                  setCustomer((current) => ({ ...current, phone: "" }));
                  setIsCustomerDialogOpen(false);
                  window.setTimeout(() => submitOrder({ allowNameOnly: true }), 0);
                }}
              >
                إرسال بالاسم فقط
              </Button>
              <Button
                type="button"
                className="h-11 rounded-2xl"
                disabled={isPending || !customer.name.trim()}
                onClick={() => {
                  setIsCustomerDialogOpen(false);
                  window.setTimeout(() => submitOrder({ allowNameOnly: true }), 0);
                }}
              >
                تأكيد وإرسال
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className={[
          "fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 backdrop-blur",
          theme.slug === "antika"
            ? "border-[#b67b31]/40 bg-[#2a160f]/95 text-[#f5eee3]"
            : theme.slug === "soul"
              ? "border-[#d4af37]/30 bg-[#1c1915]/95 text-[#f5f0e8]"
              : theme.slug === "bistro"
                ? "border-[#c9a84c]/25 bg-[#141210]/95 text-[#f5f0e8]"
                : "border-border/40 bg-background/97",
        ].join(" ")}
        style={{ boxShadow: "var(--mds-elevation-3)" }}
      >
        <div
          className={[
            "mx-auto flex items-center gap-3 rounded-3xl border p-2",
            isPremiumList || theme.slug === "bistro" ? "max-w-5xl" : "max-w-4xl",
            theme.slug === "antika"
              ? "border-[#b67b31]/30 bg-[#3a2418]/80"
              : theme.slug === "soul" || theme.slug === "bistro"
                ? "border-[#d4af37]/20 bg-[#252018]/90"
                : "border-border/40 bg-card",
          ].join(" ")}
          style={{ boxShadow: "var(--mds-elevation-1)" }}
        >
          <div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition ${
              recentlyAddedLineId ? "scale-110 bg-primary text-primary-foreground" : ""
            }`}
          >
            <ShoppingBag className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">السلة</p>
            {cart.length > 0 ? (
              <p className="truncate text-sm text-muted-foreground">
                <span className="font-bold tabular-nums text-foreground">{cartItemCount}</span> قطعة ·{" "}
                <span className="font-bold tabular-nums text-primary">
                  {formatCurrency(orderTotal, menu.organization.currency)}
                </span>
              </p>
            ) : (
              <p className="truncate text-sm text-muted-foreground">أضف منتجات للطلب</p>
            )}
          </div>
          <Button
            type="button"
            className={[
              "h-12 rounded-2xl px-5 text-base font-semibold",
              theme.slug === "soul" || theme.slug === "bistro"
                ? "bg-[#d4af37] text-[#1c1915] hover:bg-[#e0c25a]"
                : theme.slug === "antika"
                  ? "bg-[#b67b31] text-[#fffaf1] hover:bg-[#c48a3d]"
                  : "",
            ].join(" ")}
            disabled={!menu.store.canOrder && cart.length === 0}
            onClick={() => setIsCartOpen(true)}
          >
            {cart.length > 0 ? "مراجعة الطلب" : "فتح السلة"}
          </Button>
        </div>
      </div>
    </div>
  );
}
