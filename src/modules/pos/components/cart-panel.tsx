"use client";

import { Clock3, Minus, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { getCartSubtotal, getCartTotal, usePosStore } from "@/stores/pos-store";
import { CustomerAttach } from "@/modules/pos/components/customer-attach";

interface CartPanelProps {
  onCheckout: () => void;
  checkoutDisabled?: boolean;
  discountsEnabled?: boolean;
}

export function CartPanel({ onCheckout, checkoutDisabled, discountsEnabled = false }: CartPanelProps) {
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
    <div className="flex h-full min-h-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-heading text-lg font-semibold">Cart</h2>
        {cart.length > 0 && (
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-xl px-3"
              onClick={() => holdCart(customer?.name)}
            >
              Hold
            </Button>
            <Button variant="ghost" size="sm" className="h-10 rounded-xl px-3" onClick={clearCart}>
              Clear
            </Button>
          </div>
        )}
      </div>

      <CustomerAttach />

      {heldCarts.length > 0 ? (
        <div className="border-b px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Clock3 className="size-3.5" />
            Held orders
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

      <ScrollArea className="flex-1 px-2">
        {cart.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-muted-foreground">
            Tap products to add items
          </p>
        ) : (
          <ul className="space-y-2.5 py-2">
            {cart.map((line) => (
              <li
                key={line.id}
                className="flex gap-3 rounded-xl bg-muted/40 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium">{line.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(line.unitPrice)} each
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-11 rounded-xl"
                      onClick={() =>
                        updateQuantity(line.id, line.quantity - 1)
                      }
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center text-base font-medium tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="size-11 rounded-xl"
                      onClick={() =>
                        updateQuantity(line.id, line.quantity + 1)
                      }
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-11 rounded-xl"
                      onClick={() => removeItem(line.id)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-base font-semibold tabular-nums">
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
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(subtotal)}
          </span>
        </div>
        {discountsEnabled ? (
          <div className="mb-3 grid gap-1.5">
            <label className="text-sm text-muted-foreground" htmlFor="cart-discount">
              Discount
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
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium tabular-nums text-emerald-700">
              -{formatCurrency(discountAmount)}
            </span>
          </div>
        ) : null}
        <Separator className="mb-3" />
        <div className="mb-3 flex justify-between text-base">
          <span className="font-medium">Total</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
        <Button
          className="h-14 w-full rounded-xl text-base font-semibold"
          disabled={cart.length === 0 || checkoutDisabled}
          onClick={onCheckout}
        >
          Pay {formatCurrency(total)}
        </Button>
      </div>
    </div>
  );
}
