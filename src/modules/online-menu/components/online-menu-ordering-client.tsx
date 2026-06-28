"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  items: OnlineMenuItem[];
};

type CustomerForm = {
  name: string;
  phone: string;
  notes: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function lineId(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

function variantLabel(item: OnlineMenuItem, variant: OnlineMenuVariant | null) {
  return variant ? `${item.name} - ${variant.name}` : item.name;
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

interface OnlineMenuOrderingClientProps {
  slug: string;
  menu: OnlineMenuData;
}

export function OnlineMenuOrderingClient({ slug, menu }: OnlineMenuOrderingClientProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>({ name: "", phone: "", notes: "" });
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo<Group[]>(() => {
    const uncategorized = menu.items.filter((item) => !item.categoryId);
    const categories = menu.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: menu.items.filter((item) => item.categoryId === category.id),
      }))
      .filter((category) => category.items.length > 0);
    return uncategorized.length > 0
      ? [...categories, { id: "other", name: "أصناف أخرى", items: uncategorized }]
      : categories;
  }, [menu.categories, menu.items]);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  function addToCart(item: OnlineMenuItem, variant: OnlineMenuVariant | null = null) {
    const id = lineId(item.id, variant?.id ?? null);
    const unitPrice = variant?.price ?? item.price;
    setLastOrderId(null);
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

  function submitOrder() {
    if (!menu.store.orderingEnabled) return;
    startTransition(async () => {
      try {
        const result = await submitPublicOnlineOrderAction({
          slug,
          customerName: customer.name,
          customerPhone: customer.phone,
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
        toast.success("تم إرسال الطلب بنجاح");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر إرسال الطلب");
      }
    });
  }

  return (
    <div className="pb-28">
      <div className="space-y-6">
        {groups.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-border/70 bg-card/70 p-8 text-center text-muted-foreground">
            لا توجد أصناف متاحة في المنيو حالياً.
          </section>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="space-y-3">
              <h2 className="px-1 text-xl font-semibold">{group.name}</h2>
              <div className="grid grid-cols-2 gap-3">
                {group.items.map((item) => {
                  const displayPrice = getMenuItemDisplayPrice(
                    item,
                    menu.organization.currency
                  );

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-sm"
                    >
                    <div className="relative flex aspect-[4/3] min-h-36 items-center justify-center bg-primary/10">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-5xl font-bold text-primary/30">
                          {item.name.slice(0, 1)}
                        </span>
                      )}
                      {item.isPopular ? (
                        <Badge variant="secondary" className="absolute start-3 top-3">
                          الأكثر طلباً
                        </Badge>
                      ) : null}
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold">{item.name}</h3>
                          {item.description ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-end">
                          {displayPrice.label ? (
                            <p className="text-xs text-muted-foreground">{displayPrice.label}</p>
                          ) : null}
                          <p className="font-semibold text-primary">
                            {formatMoney(displayPrice.amount, menu.organization.currency)}
                            {displayPrice.range ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                {displayPrice.range}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>

                      {item.variants.length > 0 ? (
                        <div className="grid gap-2">
                          {item.variants.map((variant) => (
                            <Button
                              key={variant.id}
                              type="button"
                              variant="outline"
                              className="h-auto justify-between rounded-2xl px-3 py-2"
                              disabled={!menu.store.orderingEnabled}
                              onClick={() => addToCart(item, variant)}
                            >
                              <span>{variantLabel(item, variant)}</span>
                              <span>{formatMoney(variant.price, menu.organization.currency)}</span>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          className="h-11 w-full rounded-2xl"
                          disabled={!menu.store.orderingEnabled}
                          onClick={() => addToCart(item)}
                        >
                          إضافة للطلب
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
        <DialogContent className="bottom-0 top-auto left-1/2 max-h-[88vh] max-w-none translate-y-0 rounded-b-none rounded-t-3xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/70 px-5 py-4">
            <DialogTitle className="flex items-center justify-between gap-3 pe-8">
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-5 text-primary" />
                طلبك
              </span>
              <Badge variant="outline">{cart.length} أصناف</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[42vh] overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                اختر منتجات من الكروت لإضافتها للطلب.
              </p>
            ) : (
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li key={line.id} className="rounded-2xl bg-muted/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{line.name}</p>
                        {line.variantName ? (
                          <p className="text-xs text-muted-foreground">{line.variantName}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMoney(line.unitPrice, menu.organization.currency)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => updateQuantity(line.id, 0)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          onClick={() => updateQuantity(line.id, line.quantity - 1)}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
                          onClick={() => updateQuantity(line.id, line.quantity + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <p className="font-semibold tabular-nums">
                        {formatMoney(line.unitPrice * line.quantity, menu.organization.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-border/70 p-4">
            <div className="flex items-center justify-between text-base">
              <span className="text-muted-foreground">الإجمالي</span>
              <span className="font-semibold">{formatMoney(subtotal, menu.organization.currency)}</span>
            </div>

            {menu.store.orderingEnabled ? (
              <>
                <div className="grid gap-2">
                  <Input
                    value={customer.name}
                    onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
                    placeholder="الاسم"
                    className="h-11 rounded-2xl"
                  />
                  <Input
                    value={customer.phone}
                    onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="رقم الهاتف"
                    inputMode="tel"
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
                  onClick={submitOrder}
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

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">السلة</p>
            <p className="truncate text-sm text-muted-foreground">
              {cart.length > 0
                ? `${cart.reduce((sum, line) => sum + line.quantity, 0)} قطعة · ${formatMoney(subtotal, menu.organization.currency)}`
                : "اضف منتجات للطلب"}
            </p>
          </div>
          <Button
            type="button"
            className="h-12 rounded-2xl px-5 text-base font-semibold"
            disabled={!menu.store.orderingEnabled && cart.length === 0}
            onClick={() => setIsCartOpen(true)}
          >
            فتح السلة
          </Button>
        </div>
      </div>
    </div>
  );
}
