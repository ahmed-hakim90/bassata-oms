"use client";

import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
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
    <CompactActions className="justify-start print:hidden">
      {canPrint && printHref ? (
        <CompactAction label={t("Print")} icon={Printer} href={printHref} />
      ) : null}
      {canPdf && onExportPdf ? (
        <CompactAction
          label={t("PDF")}
          icon={FileText}
          disabled={pending}
          onClick={onExportPdf}
        />
      ) : null}
      {canExcel && onExportExcel ? (
        <CompactAction
          label={t("Excel")}
          icon={FileSpreadsheet}
          disabled={pending}
          onClick={onExportExcel}
        />
      ) : null}
      {!onExportExcel && !onExportPdf && !printHref ? (
        <CompactAction label={t("Export")} icon={Download} disabled />
      ) : null}
    </CompactActions>
  );
}
