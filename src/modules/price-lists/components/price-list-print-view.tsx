"use client";

import { useEffect, useMemo, useState } from "react";
import { PriceListPoster } from "@/modules/price-lists/components/price-list-poster";
import { computePosterHeight } from "@/modules/price-lists/lib/formats";
import { loadPriceListPrintPayload } from "@/modules/price-lists/lib/print-payload";
import { AutoPrintShell } from "@/components/print/auto-print-shell";
import type { PriceListPrintPayload } from "@/modules/price-lists/lib/formats";

export function PriceListPrintView() {
  const [payload, setPayload] = useState<PriceListPrintPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPriceListPrintPayload();
    if (!loaded || loaded.rows.length === 0) {
      setError("مفيش قائمة جاهزة للطباعة. ارجع لاستوديو الأسعار واضغط «PDF / طباعة» تاني.");
      return;
    }
    setPayload(loaded);
  }, []);

  const width = 794;
  const height = useMemo(() => {
    if (!payload) return 1123;
    return computePosterHeight({
      width,
      minHeight: 1123,
      rowCount: payload.rows.length,
      showLogo: payload.showLogo,
    });
  }, [payload]);

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          [data-price-list-row] { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          body { background: #e7e5e4; }
          .print-stage { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
        }
      `}</style>
      <AutoPrintShell
        loading={!payload && !error}
        error={error}
        backHref="/inventory/purchases/price-list"
        backLabel="رجوع لاستوديو الأسعار"
        autoPrintDelayMs={400}
      >
        {payload ? (
          <>
            <button
              type="button"
              className="no-print mb-4 rounded-xl border bg-white px-4 py-2 text-sm font-medium"
              onClick={() => window.print()}
            >
              طباعة / حفظ PDF ({payload.rows.length} صنف)
            </button>
            <PriceListPoster
              width={width}
              height={height}
              orgName={payload.orgName}
              orgLogoUrl={payload.orgLogoUrl}
              showLogo={payload.showLogo}
              listTitle={payload.listTitle}
              sectionTitle={payload.sectionTitle}
              footerText={payload.footerText}
              background={payload.background}
              accent={payload.accent}
              rows={payload.rows}
              showOldPrice={payload.showOldPrice}
              showUnitLine={payload.showUnitLine !== false}
            />
          </>
        ) : null}
      </AutoPrintShell>
    </>
  );
}
