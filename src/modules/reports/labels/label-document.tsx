"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { renderBarcodeSvg } from "@/modules/reports/labels/barcode-svg";
import type { LabelSettings } from "@/modules/reports/labels/label-settings";
import { cn } from "@/lib/utils";

export interface LabelItem {
  id: string;
  productName: string;
  variantName?: string | null;
  barcode: string;
  sku: string;
  price?: number | null;
  copies?: number;
}

interface LabelDocumentProps {
  items: LabelItem[];
  settings: LabelSettings;
  currency: string;
  className?: string;
}

export function LabelDocument({ items, settings, currency, className }: LabelDocumentProps) {
  const labels = useMemo(() => {
    const out: LabelItem[] = [];
    for (const item of items) {
      const copies = item.copies ?? settings.defaultCopies;
      for (let i = 0; i < copies; i++) out.push(item);
    }
    return out;
  }, [items, settings.defaultCopies]);

  return (
    <div
      data-print-root
      className={cn("bg-white text-black", className)}
      style={{
        padding: `${settings.pageMarginMm}mm`,
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, ${settings.labelWidthMm}mm)`,
        gap: `${settings.labelGapMm}mm`,
      }}
    >
      {labels.map((label, index) => {
        const svg = typeof window !== "undefined" ? renderBarcodeSvg(label.barcode) : "";
        return (
          <div
            key={`${label.id}-${index}`}
            className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-gray-300 p-1 text-center"
            style={{
              width: `${settings.labelWidthMm}mm`,
              height: `${settings.labelHeightMm}mm`,
            }}
          >
            <p className="line-clamp-2 text-[9px] font-semibold leading-tight">
              {label.productName}
              {label.variantName ? ` · ${label.variantName}` : ""}
            </p>
            {svg ? (
              <div
                className="my-1 max-w-full overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : null}
            <p className="text-[8px] tabular-nums">{label.barcode}</p>
            {settings.showSku ? <p className="text-[8px] text-gray-600">{label.sku}</p> : null}
            {settings.showPrice && label.price != null ? (
              <p className="text-[9px] font-semibold">{formatCurrency(label.price, currency)}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
