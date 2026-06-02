"use client";

import {
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  Star,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { submitPublicOrderAction } from "@/modules/online-menu/actions/public-menu.actions";
import type {
  PublicMenuCategory,
  PublicMenuData,
  PublicMenuProduct,
} from "@/modules/online-menu/services/public-menu.service";

interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
}

function lineTotal(line: CartLine) {
  return line.quantity * line.unitPrice;
}

function cartKey(productId: string, variantId?: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

function cleanWhatsappNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function getWhatsappUrl(number: string, message: string) {
  const clean = cleanWhatsappNumber(number);
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function PublicMenuScreen({ menu, token }: { menu: PublicMenuData; token: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{ id: string; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const settings = menu.settings;
  const primaryColor = settings.primaryColor;
  const accentColor = settings.accentColor;
  const whatsappUrl = getWhatsappUrl(settings.whatsappNumber, settings.whatsappMessage);
  const heroTitle = settings.heroTitle.trim() || menu.store.name;
  const heroSubtitle =
    settings.heroSubtitle.trim() || "Fresh picks from our menu, ready for your next visit.";

  const categoryMap = useMemo(
    () => new Map(menu.categories.map((category) => [category.id, category])),
    [menu.categories]
  );
  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menu.products.filter((product) => {
      const category = product.categoryId ? categoryMap.get(product.categoryId) : null;
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query) ||
        product.variants.some(
          (variant) =>
            variant.name.toLowerCase().includes(query) ||
            variant.sku.toLowerCase().includes(query) ||
            variant.barcode.toLowerCase().includes(query)
        ) ||
        category?.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [categoryMap, menu.products, search, selectedCategory]);
  const subtotal = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const cartItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function addProduct(product: PublicMenuProduct) {
    if (!settings.showCart) return;
    const hasVariants = settings.showVariants && product.variants.length > 0;
    const variant = hasVariants
      ? product.variants.find((item) => item.id === selectedVariants[product.id])
      : null;
    if (hasVariants && !variant) {
      toast.error("Choose an option first");
      return;
    }
    const key = cartKey(product.id, variant?.id ?? null);
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          variantId: variant?.id ?? null,
          name: product.name,
          variantName: variant?.name ?? null,
          quantity: 1,
          unitPrice: variant?.price ?? product.price,
        },
      ];
    });
  }

  function updateQuantity(key: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((line) => line.key !== key));
      return;
    }
    setCart((current) => current.map((line) => (line.key === key ? { ...line, quantity } : line)));
  }

  function submitOrder() {
    startTransition(async () => {
      try {
        const result = await submitPublicOrderAction({
          token,
          customerName,
          customerPhone,
          notes,
          lines: cart.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        });
        setSubmittedOrder(result);
        setCart([]);
        setCartOpen(false);
        toast.success("Order sent to the branch");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not submit order");
      }
    });
  }

  if (submittedOrder) {
    return (
      <main className="min-h-dvh bg-[#F7F8FA] px-4 py-8">
        <section className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center text-center">
          <div
            className="mb-5 flex size-16 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <ReceiptText className="size-8" />
          </div>
          <h1 className="text-2xl font-semibold">Order received</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {menu.store.name} has your order. The team will prepare it and confirm payment at the branch.
          </p>
          {settings.showPrices && (
            <p className="mt-6 text-lg font-semibold tabular-nums">
              {formatCurrency(submittedOrder.total)}
            </p>
          )}
          <Button className="mt-8 w-full" onClick={() => setSubmittedOrder(null)}>
            Start another order
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#F7F8FA] text-[#111827]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <LogoMark logoUrl={settings.logoUrl} storeName={menu.store.name} color={primaryColor} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Online menu
              </p>
              <h1 className="truncate text-2xl font-bold">{heroTitle}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{heroSubtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {menu.store.address && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600">
                <MapPin className="size-3.5" />
                {menu.store.address}
              </span>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <section
        className="sticky top-0 z-20 border-b border-black/5 backdrop-blur"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}F2, ${accentColor}E8)`,
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 sm:px-6 md:grid-cols-[1fr_auto]">
          {settings.showSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, categories, or options"
                className="h-11 rounded-lg bg-white pl-9"
              />
            </div>
          )}
          {settings.showCategories && (
            <CategoryStrip
              categories={menu.categories}
              selectedId={selectedCategory}
              onSelect={setSelectedCategory}
              color={primaryColor}
            />
          )}
        </div>
      </section>

      <div
        className={
          settings.showCart
            ? "mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_360px]"
            : "mx-auto max-w-6xl px-4 py-5 sm:px-6"
        }
      >
        <section className="min-w-0 space-y-4">
          {products.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-black/5">
              No products match your search
            </div>
          ) : (
            <div
              className={
                settings.productCardStyle === "compact"
                  ? "grid grid-cols-2 gap-3 md:grid-cols-2"
                  : "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3"
              }
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={product.categoryId ? categoryMap.get(product.categoryId) : undefined}
                  selectedVariantId={selectedVariants[product.id] ?? ""}
                  onSelectVariant={(variantId) =>
                    setSelectedVariants({ ...selectedVariants, [product.id]: variantId })
                  }
                  onAdd={() => addProduct(product)}
                  settings={settings}
                  primaryColor={primaryColor}
                />
              ))}
            </div>
          )}
        </section>

        {settings.showCart && (
          <aside className="hidden lg:sticky lg:top-5 lg:block lg:self-start">
            <CartPanel
              cart={cart}
              pending={pending}
              customerName={customerName}
              customerPhone={customerPhone}
              notes={notes}
              showPrices={settings.showPrices}
              subtotal={subtotal}
              onNameChange={setCustomerName}
              onPhoneChange={setCustomerPhone}
              onNotesChange={setNotes}
              onQuantityChange={updateQuantity}
              onSubmit={submitOrder}
            />
          </aside>
        )}
      </div>

      {settings.showCart && cartItemCount > 0 && (
        <button
          type="button"
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-white shadow-lg ring-1 ring-black/10 lg:hidden"
          style={{ backgroundColor: primaryColor }}
          onClick={() => setCartOpen(true)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="size-4" />
            Cart · {cartItemCount}
          </span>
          {settings.showPrices && (
            <span className="text-sm font-bold tabular-nums">{formatCurrency(subtotal)}</span>
          )}
        </button>
      )}

      {settings.showCart && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] gap-0 rounded-t-2xl p-0 lg:hidden"
          >
            <SheetHeader className="border-b pr-12">
              <SheetTitle>Cart</SheetTitle>
              <SheetDescription>
                {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
                {settings.showPrices ? ` · ${formatCurrency(subtotal)}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 overflow-y-auto p-3">
              <CartPanel
                cart={cart}
                pending={pending}
                customerName={customerName}
                customerPhone={customerPhone}
                notes={notes}
                showPrices={settings.showPrices}
                subtotal={subtotal}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
                onNotesChange={setNotes}
                onQuantityChange={updateQuantity}
                onSubmit={submitOrder}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium text-foreground">{menu.store.name}</p>
            {menu.store.address && <p>{menu.store.address}</p>}
          </div>
          <p className="max-w-xl">{settings.footerText}</p>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground">
              WhatsApp
            </a>
          )}
        </div>
      </footer>
    </main>
  );
}

function LogoMark({ logoUrl, storeName, color }: { logoUrl: string; storeName: string; color: string }) {
  if (logoUrl.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${storeName} logo`}
        className="size-16 rounded-lg border border-black/10 bg-white object-cover"
      />
    );
  }
  return (
    <div
      className="flex size-16 shrink-0 items-center justify-center rounded-lg text-2xl font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {storeName.charAt(0)}
    </div>
  );
}

function ProductCard({
  product,
  category,
  selectedVariantId,
  onSelectVariant,
  onAdd,
  settings,
  primaryColor,
}: {
  product: PublicMenuProduct;
  category?: PublicMenuCategory;
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  onAdd: () => void;
  settings: PublicMenuData["settings"];
  primaryColor: string;
}) {
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const displayImage = selectedVariant?.imageUrl ?? product.imageUrl;
  const displayPrice = selectedVariant?.price ?? product.price;
  const hasVariants = settings.showVariants && product.variants.length > 0;
  const compact = settings.productCardStyle === "compact";

  return (
    <article
      role={settings.showCart ? "button" : undefined}
      tabIndex={settings.showCart ? 0 : undefined}
      className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition active:scale-[0.99] supports-[hover:hover]:hover:shadow-md"
      onClick={onAdd}
      onKeyDown={(event) => {
        if (!settings.showCart) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAdd();
        }
      }}
    >
      {settings.showImages && !compact && (
        <ProductImage
          src={displayImage}
          name={product.name}
          categoryColor={category?.color ?? primaryColor}
        />
      )}
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {category && <Badge variant="outline">{category.name}</Badge>}
              {settings.showPopular && product.isPopular && (
                <Badge className="gap-1" style={{ backgroundColor: primaryColor }}>
                  <Star className="size-3" />
                  Popular
                </Badge>
              )}
            </div>
            <h2 className="line-clamp-2 text-base font-semibold">{product.name}</h2>
          </div>
          {settings.showImages && compact && (
            <ProductImage
              src={displayImage}
              name={product.name}
              categoryColor={category?.color ?? primaryColor}
              compact
            />
          )}
        </div>

        {hasVariants && (
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                style={{
                  borderColor: selectedVariantId === variant.id ? primaryColor : "rgba(15, 23, 42, 0.14)",
                  backgroundColor: selectedVariantId === variant.id ? `${primaryColor}14` : "transparent",
                  color: selectedVariantId === variant.id ? primaryColor : "inherit",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectVariant(variant.id);
                }}
              >
                {variant.name}
                {settings.showPrices && (
                  <span className="ml-1 tabular-nums">{formatCurrency(variant.price)}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {settings.showPrices ? (
            <p className="text-lg font-bold tabular-nums">{formatCurrency(displayPrice)}</p>
          ) : (
            <span className="text-sm text-muted-foreground">Ask for price</span>
          )}
          {settings.showCart && (
            <Button
              type="button"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onAdd();
              }}
            >
              <Plus className="size-4" />
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductImage({
  src,
  name,
  categoryColor,
  compact = false,
}: {
  src: string | null;
  name: string;
  categoryColor: string;
  compact?: boolean;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={
          compact
            ? "size-16 shrink-0 rounded-md object-cover"
            : "aspect-[4/3] w-full bg-slate-100 object-cover"
        }
      />
    );
  }
  return (
    <div
      className={
        compact
          ? "flex size-16 shrink-0 items-center justify-center rounded-md"
          : "flex aspect-[4/3] items-center justify-center"
      }
      style={{ background: `linear-gradient(145deg, ${categoryColor}22, ${categoryColor}44)` }}
    >
      <span className={compact ? "text-2xl font-bold opacity-40" : "text-5xl font-bold opacity-35"}>
        {name.charAt(0)}
      </span>
    </div>
  );
}

function CartPanel({
  cart,
  pending,
  customerName,
  customerPhone,
  notes,
  showPrices,
  subtotal,
  onNameChange,
  onPhoneChange,
  onNotesChange,
  onQuantityChange,
  onSubmit,
}: {
  cart: CartLine[];
  pending: boolean;
  customerName: string;
  customerPhone: string;
  notes: string;
  showPrices: boolean;
  subtotal: number;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onQuantityChange: (key: string, quantity: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingBag className="size-4" />
          Cart
        </h2>
        <Badge variant="outline">{cart.reduce((sum, line) => sum + line.quantity, 0)}</Badge>
      </div>
      <div className="max-h-[34dvh] overflow-auto px-3 py-2 lg:max-h-[38vh]">
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Add items from the menu</p>
        ) : (
          <ul className="space-y-2">
            {cart.map((line) => (
              <li key={line.key} className="rounded-lg bg-slate-50 p-3">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    {line.variantName && (
                      <p className="text-xs text-muted-foreground">{line.variantName}</p>
                    )}
                    {showPrices && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(line.unitPrice)} each
                      </p>
                    )}
                  </div>
                  {showPrices && (
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(lineTotal(line))}
                    </p>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => onQuantityChange(line.key, line.quantity - 1)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-7 text-center text-sm tabular-nums">{line.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => onQuantityChange(line.key, line.quantity + 1)}
                  >
                    <Plus className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onQuantityChange(line.key, 0)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-3 border-t p-4">
        {showPrices && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
        )}
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="customer-name">Name</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(event) => onNameChange(event.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={customerPhone}
              onChange={(event) => onPhoneChange(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-notes">Notes</Label>
            <Textarea
              id="order-notes"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              rows={2}
            />
          </div>
        </div>
        <Button
          className="h-11 w-full"
          disabled={pending || cart.length === 0 || !customerName.trim() || !customerPhone.trim()}
          onClick={onSubmit}
        >
          <Send className="size-4" />
          Send order
        </Button>
      </div>
    </div>
  );
}

function CategoryStrip({
  categories,
  selectedId,
  onSelect,
  color,
}: {
  categories: PublicMenuCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  color: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 md:justify-end">
      <button
        type="button"
        className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium"
        style={{
          borderColor: selectedId === null ? color : "rgba(15, 23, 42, 0.14)",
          backgroundColor: selectedId === null ? color : "white",
          color: selectedId === null ? "white" : "inherit",
        }}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium"
          style={{
            borderColor: selectedId === category.id ? color : "rgba(15, 23, 42, 0.14)",
            backgroundColor: selectedId === category.id ? color : "white",
            color: selectedId === category.id ? "white" : "inherit",
          }}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
