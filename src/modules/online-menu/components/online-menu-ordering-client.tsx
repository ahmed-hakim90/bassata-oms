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
import { submitPublicOnlineOrderAction } from "@/modules/online-orders/actions/public-online-order.actions";
import type { OnlineMenuData, OnlineMenuItem, OnlineMenuVariant } from "@/modules/online-menu/services/online-menu.service";

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

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ar-EG-u-nu-latn", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function lineId(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

function getMenuItemDisplayPrice(item: OnlineMenuItem, currency: string) {
  const variantPrices = item.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b);
  const minVariantPrice = variantPrices[0];
  const maxVariantPrice = variantPrices.at(-1);
  const hasVariantPrice = minVariantPrice != null && maxVariantPrice != null;

  return {
    label: hasVariantPrice
      ? maxVariantPrice > minVariantPrice
        ? "من أقل سعر"
        : "سعر الأحجام"
      : null,
    amount: hasVariantPrice ? minVariantPrice : item.price,
    range:
      hasVariantPrice && maxVariantPrice > minVariantPrice
        ? ` إلى ${formatMoney(maxVariantPrice, currency)}`
        : "",
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
        group.name.slice(0, 1)
      )}
    </span>
  );
}

interface OnlineMenuOrderingClientProps {
  slug: string;
  menu: OnlineMenuData;
}

export function OnlineMenuOrderingClient({ slug, menu }: OnlineMenuOrderingClientProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>({ name: "", phone: "", notes: "" });
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customerPrompt, setCustomerPrompt] = useState<string | null>(null);
  const [recentlyAddedLineId, setRecentlyAddedLineId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    if (!recentlyAddedLineId) return;
    const timeoutId = window.setTimeout(() => setRecentlyAddedLineId(null), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [recentlyAddedLineId]);

  function addToCart(item: OnlineMenuItem, variant: OnlineMenuVariant | null = null) {
    const id = lineId(item.id, variant?.id ?? null);
    const unitPrice = variant?.price ?? item.price;
    setLastOrderId(null);
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
    if (!menu.store.orderingEnabled) return;
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

    setCustomerPrompt(null);
    startTransition(async () => {
      try {
        const result = await submitPublicOnlineOrderAction({
          slug,
          customerName,
          customerPhone,
          notes: customer.notes,
          lines: cart.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        setCart([]);
        setCustomer({ name: "", phone: "", notes: "" });
        setLastOrderId(result.id);
        setIsCartOpen(false);
        toast.success("شكراً لك، تم إرسال طلبك بنجاح");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر إرسال الطلب");
      }
    });
  }

  return (
    <div id="online-menu-items" className="pb-28">
      <section className="sticky top-2 z-20 mb-5 rounded-3xl border border-border/70 bg-card/95 p-3 shadow-lg shadow-black/[0.04] backdrop-blur">
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
                variant="secondary"
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
                  className="h-10 shrink-0 rounded-full border bg-background/80 px-3"
                  style={{
                    borderColor: `${group.color}66`,
                    background: `linear-gradient(135deg, ${group.color}22, transparent)`,
                  }}
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

      {lastOrderId ? (
        <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
          <p className="font-semibold">شكراً لك، استلمنا طلبك بنجاح.</p>
          <p className="mt-1 text-sm">
            رقم المتابعة: <span className="font-mono">{lastOrderId.slice(0, 8)}</span>. سنراجع الطلب
            ونتواصل معك إذا احتجنا أي تفاصيل.
          </p>
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
          visibleGroups.map((group) => (
            <section id={`menu-category-${group.id}`} key={group.id} className="scroll-mt-28 space-y-3">
              <div
                className="flex items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/80 p-3 shadow-sm"
                style={{
                  borderColor: `${group.color}44`,
                  background: `linear-gradient(135deg, ${group.color}24, hsl(var(--card) / 0.85))`,
                }}
              >
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
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.items.map((item) => {
                  const displayPrice = getMenuItemDisplayPrice(
                    item,
                    menu.organization.currency
                  );

                  return (
                    <article
                      key={item.id}
                      className="group flex overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex-col"
                    >
                      <div className="relative flex w-44 shrink-0 items-center justify-center overflow-hidden bg-primary/10 sm:w-full sm:aspect-[4/3] sm:min-h-36">
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
                          <span className="text-6xl font-bold text-primary/30">
                            {item.name.slice(0, 1)}
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

                      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-base font-semibold leading-snug">{item.name}</h3>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="shrink-0 rounded-2xl bg-primary/10 px-3 py-2 text-end">
                            {displayPrice.label ? (
                              <p className="text-xs text-primary/80">{displayPrice.label}</p>
                            ) : null}
                            <p className="font-bold tabular-nums text-primary">
                              {formatMoney(displayPrice.amount, menu.organization.currency)}
                              {displayPrice.range ? (
                                <span className="ms-1 text-xs font-normal text-muted-foreground">
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
                                  className="h-auto justify-between rounded-2xl border-border/70 bg-background/70 px-3 py-2.5 text-start hover:border-primary/40 hover:bg-primary/5 data-[added=true]:border-primary/50 data-[added=true]:bg-primary/10"
                                  data-added={wasJustAdded}
                                  disabled={!menu.store.orderingEnabled}
                                  onClick={() => addToCart(item, variant)}
                                >
                                  <span className="min-w-0 truncate font-medium">{variant.name}</span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums">
                                      {formatMoney(variant.price, menu.organization.currency)}
                                    </span>
                                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
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
                            className="mt-auto h-11 w-full rounded-2xl text-base font-semibold"
                            disabled={!menu.store.orderingEnabled}
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
            </section>
          ))
        )}
      </div>

      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="bottom-0 top-auto left-1/2 flex max-h-[90vh] max-w-none translate-y-0 flex-col overflow-hidden rounded-b-none rounded-t-3xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-3">
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
                  <li key={line.id} className="rounded-3xl border border-border/60 bg-muted/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{line.name}</p>
                        {line.variantName ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{line.variantName}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMoney(line.unitPrice, menu.organization.currency)}
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
                      <div className="flex items-center rounded-2xl border border-border/70 bg-background p-1">
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
                        {formatMoney(line.unitPrice * line.quantity, menu.organization.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-border/70 bg-card p-4">
            <div className="rounded-3xl bg-primary/10 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-primary/80">
                <span>الإجمالي</span>
                <span>{cartItemCount} قطعة</span>
              </div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <span className="text-sm text-muted-foreground">شامل كل الأصناف المختارة</span>
                <span className="text-xl font-bold tabular-nums text-primary">
                  {formatMoney(subtotal, menu.organization.currency)}
                </span>
              </div>
            </div>

            {menu.store.orderingEnabled ? (
              <>
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
                {lastOrderId ? (
                  <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">
                    تم إرسال الطلب. رقم المتابعة: {lastOrderId.slice(0, 8)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="rounded-2xl bg-muted/60 p-3 text-center text-sm text-muted-foreground">
                الطلبات غير متاحة حالياً، المنيو للعرض فقط.
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
              الاسم يكفي لإرسال الطلب، وإضافة رقم الهاتف تساعدنا نأكد الطلب ونسجلك كعميل عندنا.
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 rounded-3xl border border-border/70 bg-card/95 p-2 shadow-sm">
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
                  {formatMoney(subtotal, menu.organization.currency)}
                </span>
              </p>
            ) : (
              <p className="truncate text-sm text-muted-foreground">أضف منتجات للطلب</p>
            )}
          </div>
          <Button
            type="button"
            className="h-12 rounded-2xl px-5 text-base font-semibold"
            disabled={!menu.store.orderingEnabled && cart.length === 0}
            onClick={() => setIsCartOpen(true)}
          >
            {cart.length > 0 ? "مراجعة الطلب" : "فتح السلة"}
          </Button>
        </div>
      </div>
    </div>
  );
}
