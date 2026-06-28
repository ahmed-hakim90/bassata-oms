"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ExportButtonGroupProps {
  printHref?: string;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  canPrint?: boolean;
  canExcel?: boolean;
  canPdf?: boolean;
  pending?: boolean;
}

export function ExportButtonGroup({
  printHref,
  onExportExcel,
  onExportPdf,
  canPrint = true,
  canExcel = true,
  canPdf = true,
  pending = false,
}: ExportButtonGroupProps) {
  const { t } = useTranslation();

  if (!canPrint && !canExcel && !canPdf) return null;

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {canPrint && printHref ? (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={printHref} target="_blank" rel="noopener noreferrer" />}
        >
          <Printer className="me-2 size-4" />
          {t("Print")}
        </Button>
      ) : null}
      {canPdf && onExportPdf ? (
        <Button variant="outline" size="sm" onClick={onExportPdf} disabled={pending}>
          <FileText className="me-2 size-4" />
          {t("PDF")}
        </Button>
      ) : null}
      {canExcel && onExportExcel ? (
        <Button variant="outline" size="sm" onClick={onExportExcel} disabled={pending}>
          <FileSpreadsheet className="me-2 size-4" />
          {t("Excel")}
        </Button>
      ) : null}
      {!onExportExcel && !onExportPdf && !printHref ? (
        <Button variant="outline" size="sm" disabled>
          <Download className="me-2 size-4" />
          {t("Export")}
        </Button>
      ) : null}
    </div>
  );
}
