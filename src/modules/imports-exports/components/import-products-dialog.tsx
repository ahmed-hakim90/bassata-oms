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
  exportProductsTemplateAction,
  importProductsAction,
  parseProductsFileAction,
} from "../actions/import-export.actions";
import type { ProductImportRow } from "../services/import.service";
import { toast } from "sonner";

function downloadBase64(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  link.download = filename;
  link.click();
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
  const [rows, setRows] = useState<ProductImportRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
    );
    startTransition(async () => {
      try {
        const parsed = await parseProductsFileAction(base64);
        setRows(parsed.rows);
        setErrors(parsed.errors);
      } catch {
        toast.error("Could not parse spreadsheet");
      }
    });
  }

  async function handleImport() {
    if (rows.length === 0) return;
    startTransition(async () => {
      try {
        const result = await importProductsAction(rows);
        toast.success(`Imported ${result.imported.length} products (${result.skipped} skipped)`);
        onOpenChange(false);
        setRows([]);
        setErrors([]);
        setFileName(null);
        onImported?.();
      } catch {
        toast.error("Import failed");
      }
    });
  }

  async function handleTemplate() {
    const { base64, filename } = await exportProductsTemplateAction();
    downloadBase64(base64, filename);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import products</DialogTitle>
          <DialogDescription>
            Upload an XLSX file using the SweetFlow template columns.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Button variant="outline" type="button" onClick={handleTemplate}>
            <Download className="size-4" />
            Download template
          </Button>

          <GlassPanel className="flex flex-col items-center gap-3 p-6 text-center">
            <Upload className="size-8 text-muted-foreground" />
            <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
              Choose spreadsheet
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {fileName ? <p className="text-xs text-muted-foreground">{fileName}</p> : null}
          </GlassPanel>

          {rows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={`${rows.length} rows`} variant="info" />
              {errors.length > 0 ? (
                <StatusPill label={`${errors.length} issues`} variant="warning" />
              ) : (
                <StatusPill label="Ready" variant="success" />
              )}
            </div>
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
        </div>

        <DialogFooter className="px-0 pb-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || rows.length === 0 || errors.length > 0}
            onClick={handleImport}
          >
            Import {rows.length > 0 ? rows.length : ""} rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
