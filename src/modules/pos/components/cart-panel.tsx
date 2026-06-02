"use client";

import { Clock3, Minus, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { getCartSubtotal, getCartTotal, usePosStore } from "@/stores/pos-store";
import { CustomerAttach } from "@/modules/pos/components/customer-attach";
import { useTranslation } from "@/lib/i18n/use-translation";

interface CartPanelProps {
  onCheckout: () => void;
  checkoutDisabled?: boolean;
  discountsEnabled?: boolean;
}

export function CartPanel({ onCheckout, checkoutDisabled, discountsEnabled = false }: CartPanelProps) {
  const { t } = useTranslation();
  const cart = usePosStore((s) => s.cart);
  const heldCarts = usePosStore((s) => s.heldCarts);
  const customer = usePosStore((s) => s.customer);
  const discountAmount = usePosStore((s) => s.discountAmount);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const removeItem = usePosStore((s) => s.removeItem);
  const clearCart = usePosStore((s) => s.clearCart);
  const setDiscountAmount = usePosStore((s) => s.setDiscountAmount);
  const holdCart = usePosStore((s) => s.holdCart);
  const resumeHeldCart = usePosStore((s) => s.resumeHeldCart);
  const removeHeldCart = usePosStore((s) => s.removeHeldCart);

  const subtotal = getCartSubtotal(cart);
  const total = getCartTotal(cart, discountAmount);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-none bg-white shadow-none ring-0 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-black/5">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-heading text-lg font-semibold">{t("Cart")}</h2>
        {cart.length > 0 && (
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-xl px-3"
              onClick={() => holdCart(customer?.name)}
            >
              {t("Hold")}
            </Button>
            <Button variant="ghost" size="sm" className="h-10 rounded-xl px-3" onClick={clearCart}>
              {t("Clear")}
            </Button>
          </div>
        )}
      </div>

      <CustomerAttach />

      {heldCarts.length > 0 ? (
        <div className="border-b px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Clock3 className="size-3.5" />
            {t("Held orders")}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {heldCarts.map((held) => (
              <div
                key={held.id}
                className="flex shrink-0 items-center gap-1 rounded-xl border bg-muted/30 p-1"
              >
                <button
                  type="button"
                  className="max-w-28 truncate px-2 text-sm font-medium"
                  onClick={() => resumeHeldCart(held.id)}
                >
                  {held.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-7 rounded-lg"
                  onClick={() => removeHeldCart(held.id)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 px-2">
        {cart.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-muted-foreground">
            {t("Tap products to add items")}
          </p>
        ) : (
          <ul className="space-y-2.5 py-2">
            {cart.map((line) => (
              <li
                key={line.id}
                className="rounded-xl bg-muted/40 px-3 py-3 xl:flex xl:items-start xl:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 xl:block">
                    <p className="text-sm font-medium leading-snug xl:truncate xl:text-base">
                      {line.name}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums xl:hidden">
                      {formatCurrency(line.lineTotal)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatCurrency(line.unitPrice)} {line.saleUnit ? `/${line.saleUnit}` : t("each")}
                  </p>
                  {line.wholesaleApplied ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700">{t("Wholesale price applied")}</p>
                  ) : null}
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 xl:mt-0 xl:flex-col xl:items-end xl:gap-1">
                  <div className="flex items-center gap-1 xl:gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
                      onClick={() =>
                        updateQuantity(line.id, line.quantity - 1)
                      }
                    >
                      <Minus className="size-3.5 xl:size-4" />
                    </Button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums xl:w-8 xl:text-base">
                      {line.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
                      onClick={() =>
                        updateQuantity(line.id, line.quantity + 1)
                      }
                    >
                      <Plus className="size-3.5 xl:size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-9 rounded-xl xl:size-11"
                      onClick={() => removeItem(line.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground xl:size-4" />
                    </Button>
                  </div>
                  <p className="hidden text-base font-semibold tabular-nums xl:block">
                    {formatCurrency(line.lineTotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        {customer && (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="size-4" />
            {customer.name}
          </p>
        )}
        <div className="mb-3 flex justify-between text-base">
          <span className="text-muted-foreground">{t("Subtotal")}</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(subtotal)}
          </span>
        </div>
        {discountsEnabled ? (
          <div className="mb-3 grid gap-1.5">
            <label className="text-sm text-muted-foreground" htmlFor="cart-discount">
              {t("Discount")}
            </label>
            <Input
              id="cart-discount"
              type="number"
              min="0"
              max={subtotal}
              step="0.01"
              value={discountAmount || ""}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
              className="h-10 rounded-xl"
            />
          </div>
        ) : null}
        {discountAmount > 0 ? (
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("Discount")}</span>
            <span className="font-medium tabular-nums text-emerald-700">
              -{formatCurrency(discountAmount)}
            </span>
          </div>
        ) : null}
        <Separator className="mb-3" />
        <div className="mb-3 flex justify-between text-base">
          <span className="font-medium">{t("Total")}</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
        <Button
          className="h-14 w-full rounded-xl text-base font-semibold"
          disabled={cart.length === 0 || checkoutDisabled}
          onClick={onCheckout}
        >
          {t("Pay")} {formatCurrency(total)}
        </Button>
      </div>
    </div>
  );
}
