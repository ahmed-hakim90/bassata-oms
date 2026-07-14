"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Barcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { matchProducts } from "@/modules/products/lib/match-products";
import type { Product } from "@/lib/types";

interface ProductSearchComboboxProps {
  /** All available products */
  products: Product[];
  /** Current search query */
  value: string;
  /** Query change handler */
  onChange: (value: string) => void;
  /** Product selection handler */
  onSelect: (product: Product) => void;
  /** Currently selected product ID (if any) */
  selectedProductId?: string;
  /** Label text (default: "باركود / بحث منتج") */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Optional currency for price display */
  currency?: string;
  /** Input class override */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Reusable product search combobox with:
 * - Exact barcode/SKU match priority
 * - Fuzzy name/barcode/SKU search
 * - Keyboard navigation (ArrowUp/Down/Enter/Escape)
 * - Blur timing to preserve click handler
 */
export function ProductSearchCombobox({
  products,
  value,
  onChange,
  onSelect,
  selectedProductId,
  label = "باركود / بحث منتج",
  placeholder = "امسح باركود أو ابحث بالاسم…",
  currency,
  className,
  autoFocus = false,
}: ProductSearchComboboxProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const searchMatches = matchProducts(products, value);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || searchMatches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % searchMatches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  return (
    <div className="relative">
      <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Barcode className="size-3.5" />
        {label}
      </Label>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue);
          setSearchOpen(newValue.trim().length > 0);
          setHighlightIndex(0);
        }}
        onFocus={() => {
          if (value.trim().length > 0) setSearchOpen(true);
        }}
        onBlur={() => {
          // Delay so list item click registers
          setTimeout(() => setSearchOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="next"
        className={className}
      />
      {searchOpen && value.trim().length > 0 ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-lg"
        >
          {searchMatches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              لا يوجد منتج مطابق
            </li>
          ) : (
            searchMatches.map((p, index) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlightIndex}
                  className={
                    index === highlightIndex
                      ? "flex w-full flex-col items-start gap-0.5 rounded-lg bg-accent px-3 py-2.5 text-right"
                      : "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-right hover:bg-muted/60"
                  }
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    onSelect(p);
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.sku ? `${p.sku}` : ""}
                    {p.barcode ? `${p.sku ? " · " : ""}${p.barcode}` : ""}
                    {currency && p.base_price > 0
                      ? `${p.sku || p.barcode ? " · " : ""}${formatCurrency(p.base_price, currency)}`
                      : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
