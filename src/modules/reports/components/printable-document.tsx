"use client";

import Image from "next/image";
import { ReportFooter } from "@/modules/reports/components/report-footer";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

type PrintableLayout = "a4" | "receipt";

interface PrintableDocumentProps {
  branding: ReportBranding;
  title: string;
  subtitle?: string;
  dateRange?: string;
  generatedBy: string;
  generatedAt: string;
  filterSummary?: string;
  layout?: PrintableLayout;
  children: React.ReactNode;
  className?: string;
}

export function PrintableDocument({
  branding,
  title,
  subtitle,
  dateRange,
  generatedBy,
  generatedAt,
  filterSummary,
  layout = "a4",
  children,
  className,
}: PrintableDocumentProps) {
  const { t } = useTranslation();
  const isReceipt = layout === "receipt";

  return (
    <div
      data-print-root
      className={cn(
        "bg-white text-black",
        isReceipt ? "mx-auto max-w-xs p-4 font-mono text-sm" : "mx-auto max-w-[210mm] p-8 text-sm",
        className
      )}
    >
      <header className="mb-6 border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            {branding.orgLogoUrl ? (
              <div
                className={cn(
                  "mb-2 shrink-0 overflow-hidden rounded-md bg-white",
                  isReceipt ? "size-10" : "size-14"
                )}
              >
                <Image
                  src={branding.orgLogoUrl}
                  alt={branding.orgName}
                  width={isReceipt ? 40 : 56}
                  height={isReceipt ? 40 : 56}
                  className="size-full object-contain"
                  unoptimized
                />
              </div>
            ) : null}
            <h1 className="text-lg font-bold">{branding.orgName}</h1>
            {branding.storeName ? (
              <p className="text-muted-foreground">{branding.storeName}</p>
            ) : null}
            {branding.storeAddress ? <p className="text-xs">{branding.storeAddress}</p> : null}
            {branding.storePhone ? <p className="text-xs">{branding.storePhone}</p> : null}
            {branding.receiptHeader ? (
              <p className="mt-2 whitespace-pre-wrap text-xs">{branding.receiptHeader}</p>
            ) : null}
          </div>
          <div className="text-end text-xs">
            <p className="font-semibold">{t(title)}</p>
            {subtitle ? <p>{subtitle}</p> : null}
            {dateRange ? <p>{dateRange}</p> : null}
          </div>
        </div>
      </header>

      <main>{children}</main>

      {branding.receiptFooter ? (
        <p className="mt-6 text-center text-xs whitespace-pre-wrap">{branding.receiptFooter}</p>
      ) : null}

      <ReportFooter
        generatedBy={generatedBy}
        generatedAt={generatedAt}
        filterSummary={filterSummary}
      />
    </div>
  );
}
