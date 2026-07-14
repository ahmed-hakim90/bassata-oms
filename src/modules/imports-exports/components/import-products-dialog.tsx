"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/SweetFlow/glass-panel";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import {
  exportProductsDataAction,
  exportProductsTemplateAction,
  importProductsAction,
  parseProductsFileAction,
} from "../actions/import-export.actions";
import type { ParsedImportResult } from "../services/import.service";
import { toast } from "sonner";

type ImportStage =
  | "idle"
  | "reading"
  | "parsing"
  | "ready"
  | "importing"
  | "imported"
  | "template"
  | "exporting";

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  link.download = filename;
  link.click();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
  activityType?: import("@/lib/types").BusinessActivityType;
}

export function ImportProductsDialog({
  open,
  onOpenChange,
  onImported,
  activityType = "cafe",
}: ImportProductsDialogProps) {
  const [parsed, setParsed] = useState<ParsedImportResult | null>(null);
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [warnings, setWarnings] = useState<{ row: number; field: string; message: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSupermarket = activityType === "supermarket";
  const progressLabel =
    stage === "reading"
      ? isSupermarket
        ? "قراءة الملف…"
        : "Reading spreadsheet"
      : stage === "parsing"
        ? isSupermarket
          ? "فحص المنتجات والأسعار…"
          : "Checking products, variants, and recipes"
        : stage === "ready"
          ? isSupermarket
            ? "جاهز للاستيراد"
            : "Ready to import"
          : stage === "importing"
            ? isSupermarket
              ? "جاري استيراد المنتجات…"
              : "Importing products"
            : stage === "imported"
              ? isSupermarket
                ? "تم الاستيراد"
                : "Import completed"
                : stage === "template"
                ? isSupermarket
                  ? "تجهيز القالب…"
                  : "Preparing template"
                : stage === "exporting"
                  ? isSupermarket
                    ? "تصدير الكتالوج…"
                    : "Exporting catalog"
                  : "";

  async function handleFile(file: File | null) {
    if (!file || busy) return;
    setFileName(file.name);
    setParsed(null);
    setErrors([]);
    setWarnings([]);
    setImportSummary(null);
    setStage("reading");
    setProgress(15);
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      setProgress(35);
      const base64 = arrayBufferToBase64(buffer);
      setStage("parsing");
      setProgress(55);
      const result = await parseProductsFileAction(base64);
      setParsed(result);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setStage("ready");
      setProgress(100);
    } catch {
      setStage("idle");
      setProgress(0);
      toast.error("Could not parse spreadsheet");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (busy || !parsed || parsed.rows.length + parsed.variants.length + parsed.recipes.length === 0) {
      return;
    }
    setBusy(true);
    setStage("importing");
    setProgress(65);
    try {
      const result = await importProductsAction(parsed);
      setProgress(100);
      setStage("imported");
      const summary = isSupermarket
        ? `أُضيف ${result.imported}، تحدّث ${result.updated}، بدون تغيير ${result.unchanged}، تم تخطي ${result.skipped}`
        : `Added ${result.imported}, updated ${result.updated}, unchanged ${result.unchanged}, variants changed ${result.variantsImported + result.variantsUpdated}, variants unchanged ${result.variantsUnchanged}, skipped ${result.skipped}`;
      setImportSummary(summary);
      setWarnings(result.warnings);
      toast.success(summary);
      if (result.warnings.length === 0 && result.skipped === 0) {
        onOpenChange(false);
        setParsed(null);
        setErrors([]);
        setWarnings([]);
        setImportSummary(null);
        setFileName(null);
        setProgress(0);
        setStage("idle");
      }
      // Refresh after UI state is committed so the dialog never stays stuck on "importing".
      onImported?.();
    } catch {
      setStage("ready");
      setProgress(100);
      toast.error("Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleTemplate() {
    if (busy) return;
    setBusy(true);
    setStage("template");
    setProgress(45);
    try {
      const { base64, filename } = await exportProductsTemplateAction();
      setProgress(100);
      downloadBase64(base64, filename);
      toast.success("Template downloaded");
    } catch {
      toast.error("Could not download template");
    } finally {
      setStage(parsed ? "ready" : "idle");
      setProgress(parsed ? 100 : 0);
      setBusy(false);
    }
  }

  async function handleExportCatalog() {
    if (busy) return;
    setBusy(true);
    setStage("exporting");
    setProgress(45);
    try {
      const { base64, filename } = await exportProductsDataAction();
      setProgress(100);
      downloadBase64(base64, filename);
      toast.success("Catalog exported — edit prices or fields, then re-upload");
    } catch {
      toast.error("Could not export catalog");
    } finally {
      setStage(parsed ? "ready" : "idle");
      setProgress(parsed ? 100 : 0);
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>استيراد / تصدير المنتجات</DialogTitle>
          <DialogDescription>
            {activityType === "supermarket"
              ? "صدّر الكتالوج أو نزّل قالب سوبر ماركت (قطعة / وزن / قطع داخل الكرتونة)، عدّل في Excel ثم ارفع الملف."
              : activityType === "retail" ||
                  activityType === "wholesale" ||
                  activityType === "mixed"
                ? "صدّر الكتالوج أو نزّل قالب منتجات الرف، عدّل في Excel ثم ارفع الملف."
                : "صدّر الكتالوج أو نزّل قالب المنيو (أحجام ووصفات)، عدّل في Excel ثم ارفع الملف."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" type="button" onClick={handleExportCatalog} disabled={busy}>
              <Download className="size-4" />
              تصدير الكتالوج الحالي
            </Button>
            <Button variant="outline" type="button" onClick={handleTemplate} disabled={busy}>
              <Download className="size-4" />
              تنزيل قالب فارغ
            </Button>
          </div>

          <GlassPanel className="flex flex-col items-center gap-3 p-6 text-center">
            <Upload className="size-8 text-muted-foreground" />
            <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
              اختيار ملف Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                disabled={busy}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}
            <p className="max-w-sm text-xs text-muted-foreground">
              {activityType === "supermarket"
                ? "ورقة المنتجات: قطعة بباركود، منتج وزني بسعر الكيلو، ووحدة شراء (كرتونة/كيس) مع عدد القطع أو الكيلو."
                : "Use Products for items and ingredients, Variants for sizes and prices, and Recipes when you need inventory deduction."}
            </p>
          </GlassPanel>

          {stage !== "idle" ? (
            <div className="grid gap-2" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progressLabel}</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label={progressLabel}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {parsed ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={
                  isSupermarket
                    ? `${parsed.rows.length} منتج`
                    : `${parsed.rows.length} products`
                }
                variant="info"
              />
              {!isSupermarket ? (
                <>
                  <StatusPill label={`${parsed.variants.length} variants`} variant="info" />
                  <StatusPill label={`${parsed.recipes.length} recipe lines`} variant="info" />
                </>
              ) : null}
              {warnings.length > 0 ? (
                <StatusPill
                  label={
                    isSupermarket
                      ? `${warnings.length} تحذير`
                      : `${warnings.length} warnings`
                  }
                  variant="warning"
                />
              ) : null}
              {errors.length > 0 ? (
                <StatusPill
                  label={
                    isSupermarket ? `${errors.length} مشكلة` : `${errors.length} issues`
                  }
                  variant="warning"
                />
              ) : (
                <StatusPill label={isSupermarket ? "جاهز" : "Ready"} variant="success" />
              )}
            </div>
          ) : null}

          {importSummary ? (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {importSummary}
            </p>
          ) : null}

          {errors.length > 0 ? (
            <ul className="max-h-32 overflow-auto text-xs text-amber-800 dark:text-amber-200">
              {errors.slice(0, 8).map((e, i) => (
                <li key={`${e.row}-${e.field}-${i}`}>
                  Row {e.row} · {e.field}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}

          {warnings.length > 0 ? (
            <ul className="max-h-32 overflow-auto text-xs text-muted-foreground">
              {warnings.slice(0, 8).map((warning, i) => (
                <li key={`${warning.row}-${warning.field}-${i}`}>
                  Row {warning.row} · {warning.field}: {warning.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter className="px-0 pb-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              !parsed ||
              parsed.rows.length + parsed.variants.length + parsed.recipes.length === 0 ||
              errors.length > 0
            }
            onClick={handleImport}
          >
            Import {parsed ? parsed.rows.length + parsed.variants.length : ""} rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
