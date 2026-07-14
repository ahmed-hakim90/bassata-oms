"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { computeLabelFontMetrics } from "@/modules/reports/labels/auto-font";
import { renderBarcodeSvg } from "@/modules/reports/labels/barcode-svg";
import {
  expandLabelPrintItems,
  type LabelJobSettings,
  type LabelPrintItem,
  type LabelPrintJob,
} from "@/modules/reports/labels/print-job";
import { cn } from "@/lib/utils";

interface LabelDocumentProps {
  job: LabelPrintJob;
  className?: string;
  /** Screen preview can hide dashed borders when printing. */
  preview?: boolean;
}

function LabelCell({
  item,
  settings,
  currency,
  preview,
}: {
  item: LabelPrintItem;
  settings: LabelJobSettings;
  currency: string;
  preview?: boolean;
}) {
  const fonts = computeLabelFontMetrics(settings, item);
  const barcodeValue = item.barcode.trim();
  const svg =
    settings.showBarcode && barcodeValue && typeof window !== "undefined"
      ? renderBarcodeSvg(barcodeValue, fonts.barcodeModuleWidth, fonts.barcodeHeightPx)
      : "";

  const title = [
    settings.showName ? item.productName : null,
    settings.showVariant && item.variantName ? item.variantName : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center overflow-hidden text-center",
        preview ? "border border-dashed border-gray-300" : "border border-transparent"
      )}
      style={{
        width: `${settings.labelWidthMm}mm`,
        height: `${settings.labelHeightMm}mm`,
        padding: `${fonts.padMm}mm`,
      }}
    >
      {title ? (
        <p
          className="line-clamp-2 w-full font-semibold leading-tight"
          style={{ fontSize: `${fonts.nameMm}mm` }}
        >
          {title}
        </p>
      ) : null}
      {svg ? (
        <div
          className="my-[0.4mm] max-w-full overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
      {settings.showBarcodeNumber && barcodeValue ? (
        <p className="tabular-nums leading-tight" style={{ fontSize: `${fonts.metaMm}mm` }}>
          {barcodeValue}
        </p>
      ) : null}
      {settings.showSku && item.sku.trim() ? (
        <p className="leading-tight text-gray-700" style={{ fontSize: `${fonts.metaMm}mm` }}>
          {item.sku}
        </p>
      ) : null}
      {settings.showPrice && item.price != null ? (
        <p className="font-semibold leading-tight" style={{ fontSize: `${fonts.nameMm}mm` }}>
          {formatCurrency(item.price, currency)}
        </p>
      ) : null}
    </div>
  );
}

export function LabelDocument({ job, className, preview = false }: LabelDocumentProps) {
  const labels = useMemo(() => expandLabelPrintItems(job), [job]);
  const { settings, currency } = job;

  return (
    <div
      data-print-root
      data-print-layout={settings.preset === "a4_labels" ? "labels-a4" : "labels-thermal"}
      data-label-width={settings.labelWidthMm}
      data-label-height={settings.labelHeightMm}
      className={cn("bg-white text-black", className)}
      style={{
        padding: `${settings.pageMarginMm}mm`,
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, ${settings.labelWidthMm}mm)`,
        gap: `${settings.labelGapMm}mm`,
        justifyContent: "start",
      }}
    >
      {labels.map((label, index) => (
        <LabelCell
          key={`${label.id}-${index}`}
          item={label}
          settings={settings}
          currency={currency}
          preview={preview}
        />
      ))}
    </div>
  );
}
