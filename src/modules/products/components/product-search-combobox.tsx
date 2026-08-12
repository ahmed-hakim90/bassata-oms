"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useId,
  type KeyboardEvent,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
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
  /** Optional external ref for focus after line add */
  inputRef?: Ref<HTMLInputElement>;
  /** Keep parent highlight in sync (form Enter fallback) */
  onHighlightChange?: (index: number) => void;
}

/**
 * Reusable product search combobox with:
 * - Exact barcode/SKU match priority
 * - Fuzzy name/barcode/SKU search
 * - Keyboard navigation (ArrowUp/Down/Home/End/Enter/Escape/Tab)
 * - Portaled listbox (survives overflow:hidden parents)
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
  inputRef,
  onHighlightChange,
}: ProductSearchComboboxProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const localRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const highlightIndexRef = useRef(0);
  const listboxId = useId();

  function setHighlight(next: number) {
    highlightIndexRef.current = next;
    setHighlightIndex(next);
    onHighlightChange?.(next);
  }

  function setRefs(node: HTMLInputElement | null) {
    localRef.current = node;
    if (typeof inputRef === "function") {
      inputRef(node);
    } else if (inputRef) {
      inputRef.current = node;
    }
  }

  useEffect(() => {
    if (autoFocus && localRef.current) {
      localRef.current.focus();
    }
  }, [autoFocus]);

  const searchMatches = matchProducts(products, value);
  const showList = searchOpen && value.trim().length > 0;

  useLayoutEffect(() => {
    if (!showList) {
      setMenuBox(null);
      return;
    }

    function updatePosition() {
      const input = localRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showList, value, searchMatches.length]);

  useEffect(() => {
    if (!showList) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (localRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setSearchOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [showList]);

  useEffect(() => {
    if (!showList || !listRef.current) return;
    const option = listRef.current.querySelector<HTMLElement>(
      `[data-highlight-index="${highlightIndex}"]`
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, showList]);

  // Keep highlight in range when the match list shrinks.
  useEffect(() => {
    if (searchMatches.length === 0) {
      if (highlightIndexRef.current !== 0) {
        highlightIndexRef.current = 0;
        setHighlightIndex(0);
        onHighlightChange?.(0);
      }
      return;
    }
    if (highlightIndexRef.current >= searchMatches.length) {
      highlightIndexRef.current = 0;
      setHighlightIndex(0);
      onHighlightChange?.(0);
    }
  }, [searchMatches.length, onHighlightChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      setSearchOpen(false);
      return;
    }

    if (!showList) return;

    if (e.key === "ArrowDown") {
      if (searchMatches.length === 0) return;
      e.preventDefault();
      setHighlight((highlightIndexRef.current + 1) % searchMatches.length);
      return;
    }
    if (e.key === "ArrowUp") {
      if (searchMatches.length === 0) return;
      e.preventDefault();
      setHighlight(
        (highlightIndexRef.current - 1 + searchMatches.length) % searchMatches.length
      );
      return;
    }
    if (e.key === "Home") {
      if (searchMatches.length === 0) return;
      e.preventDefault();
      setHighlight(0);
      return;
    }
    if (e.key === "End") {
      if (searchMatches.length === 0) return;
      e.preventDefault();
      setHighlight(searchMatches.length - 1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setSearchOpen(false);
      return;
    }
    if (e.key === "Enter" && searchMatches.length > 0) {
      const pick =
        searchMatches[
          Math.min(highlightIndexRef.current, searchMatches.length - 1)
        ];
      if (!pick) return;

      // Already on the selected product → close list and let the form add the line.
      if (selectedProductId && pick.id === selectedProductId) {
        setSearchOpen(false);
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      onSelect(pick);
      setSearchOpen(false);
    }
  };

  const listbox =
    showList && menuBox && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            id={listboxId}
            className="fixed z-[var(--mds-z-dropdown)] max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-lg"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
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
                    id={`${listboxId}-option-${p.id}`}
                    data-highlight-index={index}
                    aria-selected={index === highlightIndex}
                    className={
                      index === highlightIndex
                        ? "flex w-full flex-col items-start gap-0.5 rounded-lg bg-accent px-3 py-2.5 text-right"
                        : "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-right hover:bg-muted/60"
                    }
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      onSelect(p);
                      setSearchOpen(false);
                    }}
                    onMouseEnter={() => setHighlight(index)}
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
          </ul>,
          document.body
        )
      : null;

  const activeOptionId =
    showList && searchMatches[highlightIndex]
      ? `${listboxId}-option-${searchMatches[highlightIndex]!.id}`
      : undefined;

  return (
    <div className="relative">
      <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Barcode className="size-3.5" />
        {label}
      </Label>
      <Input
        ref={setRefs}
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeOptionId}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue);
          setSearchOpen(newValue.trim().length > 0);
          setHighlight(0);
        }}
        onFocus={() => {
          if (value.trim().length > 0) setSearchOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            if (listRef.current?.contains(document.activeElement)) return;
            setSearchOpen(false);
          }, 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="next"
        className={className}
      />
      {listbox}
    </div>
  );
}
