"use client";

import { useState, useTransition } from "react";
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
}

export function ImportProductsDialog({
  open,
  onOpenChange,
  onImported,
}: ImportProductsDialogProps) {
  const [parsed, setParsed] = useState<ParsedImportResult | null>(null);
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [warnings, setWarnings] = useState<{ row: number; field: string; message: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<ImportStage>("idle");
  const [progress, setProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const progressLabel =
    stage === "reading"
      ? "Reading spreadsheet"
      : stage === "parsing"
        ? "Checking products, variants, and recipes"
        : stage === "ready"
          ? "Ready to import"
          : stage === "importing"
            ? "Importing products"
            : stage === "imported"
              ? "Import completed"
              : stage === "template"
                ? "Preparing template"
                : stage === "exporting"
                  ? "Exporting catalog"
                  : "";

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setErrors([]);
    setWarnings([]);
    setImportSummary(null);
    setStage("reading");
    setProgress(15);
    const buffer = await file.arrayBuffer();
    setProgress(35);
    const base64 = arrayBufferToBase64(buffer);
    setStage("parsing");
    setProgress(55);
    startTransition(async () => {
      try {
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
      }
    });
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length + parsed.variants.length + parsed.recipes.length === 0) return;
    setStage("importing");
    setProgress(65);
    startTransition(async () => {
      try {
        const result = await importProductsAction(parsed);
        setProgress(100);
        setStage("imported");
        const summary = `Added ${result.imported.length}, updated ${result.updated.length}, unchanged ${result.unchanged.length}, variants changed ${result.variantsImported.length + result.variantsUpdated.length}, variants unchanged ${result.variantsUnchanged.length}, skipped ${result.skipped}`;
        setImportSummary(summary);
        setWarnings(result.warnings);
        toast.success(summary);
        onImported?.();
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
      } catch {
        setStage("ready");
        setProgress(100);
        toast.error("Import failed");
      }
    });
  }

  async function handleTemplate() {
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
    }
  }

  async function handleExportCatalog() {
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import / export products</DialogTitle>
          <DialogDescription>
            Export the live catalog, edit in Excel, then re-upload. Matching SKUs upsert products,
            variants, and recipes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" type="button" onClick={handleExportCatalog} disabled={pending}>
              <Download className="size-4" />
              Export current catalog
            </Button>
            <Button variant="outline" type="button" onClick={handleTemplate} disabled={pending}>
              <Download className="size-4" />
              Download empty template
            </Button>
          </div>

          <GlassPanel className="flex flex-col items-center gap-3 p-6 text-center">
            <Upload className="size-8 text-muted-foreground" />
            <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
              Choose spreadsheet
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                disabled={pending}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}
            <p className="max-w-sm text-xs text-muted-foreground">
              Use Products for items and ingredients, Variants for sizes and prices, and Recipes
              only when you want inventory deduction and accurate profit.
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
              <StatusPill label={`${parsed.rows.length} products`} variant="info" />
              <StatusPill label={`${parsed.variants.length} variants`} variant="info" />
              <StatusPill label={`${parsed.recipes.length} recipe lines`} variant="info" />
              {warnings.length > 0 ? (
                <StatusPill label={`${warnings.length} warnings`} variant="warning" />
              ) : null}
              {errors.length > 0 ? (
                <StatusPill label={`${errors.length} issues`} variant="warning" />
              ) : (
                <StatusPill label="Ready" variant="success" />
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
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
