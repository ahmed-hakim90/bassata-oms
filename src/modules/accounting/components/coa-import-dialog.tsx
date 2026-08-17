"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/Velora/confirm-action-dialog";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import {
  exportChartOfAccountsAction,
  importChartOfAccountsAction,
  previewChartOfAccountsImportAction,
} from "@/modules/accounting/actions/gl-account.actions";
import { COA_IMPORT_MAX_BYTES } from "@/modules/accounting/lib/coa-import";
import type { ParsedCoaImport } from "@/modules/accounting/services/coa-import.service";

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

type CoaImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function CoaImportDialog({
  open,
  onOpenChange,
  onImported,
}: CoaImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedCoaImport | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reset = () => {
    setFileName(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (next: boolean) => {
    if (busy && !next) return;
    if (!next) reset();
    onOpenChange(next);
  };

  async function handleDownload() {
    setBusy(true);
    try {
      const result = await exportChartOfAccountsAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBase64(result.data.base64, result.data.filename);
      toast.success("تم تحميل الشجرة الحالية");
    } catch {
      toast.error("فشل تحميل الملف");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | null) {
    if (!file || busy) return;
    if (file.size > COA_IMPORT_MAX_BYTES) {
      toast.error("الملف أكبر من 1.5 ميجا");
      return;
    }
    setFileName(file.name);
    setPreview(null);
    setBusy(true);
    try {
      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      const result = await previewChartOfAccountsImportAction(base64);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPreview(result.data);
      if (result.data.errors.length > 0) {
        toast.error("في أخطاء في الملف — صلّحها وارفعي تاني");
      }
    } catch {
      toast.error("تعذر قراءة الملف");
    } finally {
      setBusy(false);
    }
  }

  const canImport =
    !!preview && preview.errors.length === 0 && preview.rows.length > 0;

  async function runImport() {
    if (!preview) throw new Error("مفيش ملف");
    const result = await importChartOfAccountsAction(preview.rows);
    if (!result.ok) {
      toast.error(result.error);
      throw new Error(result.error);
    }
    toast.success(
      result.data.openingsPosted
        ? `اتضاف ${result.data.created} · اتحدّث ${result.data.updated} · قيد أول المدة على ${result.data.openingAccounts} حساب`
        : `اتضاف ${result.data.created} · اتحدّث ${result.data.updated} · بدون تغيير ${result.data.unchanged}`
    );
    reset();
    onImported();
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <StandardModalContent
          size="md"
          title="رفع شجرة الحسابات"
          description="Excel أو CSV بالكود. الإضافة والتحديث بالكود — الحسابات الحالية اللي مش في الملف تفضل، وحسابات النظام محمية. أعمدة المدين/الدائن تسجّل قيد أول المدة على مستوى المؤسسة (مش فرع)."
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={busy}
                onClick={() => handleClose(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl font-semibold"
                disabled={busy || !canImport}
                onClick={() => setConfirmOpen(true)}
              >
                تنفيذ الرفع
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={busy}
                onClick={() => void handleDownload()}
              >
                <Download className="size-4" />
                تحميل الشجرة الحالية
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coa-import-file">ملف الشجرة</Label>
              <Input
                ref={fileRef}
                id="coa-import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={busy}
                className="h-11 cursor-pointer rounded-xl"
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  الأعمدة: كود · اسم · نوع · كود الأب · قابل للترحيل · ترتيب · مدين أول المدة · دائن أول المدة
                </p>
              )}
            </div>

            {preview ? (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                {preview.errors.length > 0 ? (
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">
                      {preview.errors.length} خطأ — الرفع متوقف
                    </p>
                    <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto ps-5 text-muted-foreground">
                      {preview.errors.slice(0, 12).map((error) => (
                        <li key={`${error.row}-${error.field}-${error.message}`}>
                          صف {error.row || "—"} · {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p>
                      هيتعمل: إضافة {preview.summary.created} · تحديث{" "}
                      {preview.summary.updated} · بدون تغيير {preview.summary.unchanged}
                    </p>
                    {preview.openings.accounts > 0 ? (
                      <p>
                        أول المدة: {preview.openings.accounts} حساب · مدين{" "}
                        {preview.openings.debit.toFixed(2)} · دائن{" "}
                        {preview.openings.credit.toFixed(2)} — قيد المؤسسة (مش فرع)، والقيد السابق هيتعوّض
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        مفيش أرصدة أول المدة في الملف — القيد السابق إن وجد هيفضل
                      </p>
                    )}
                  </div>
                )}
                {preview.warnings.length > 0 ? (
                  <ul className="mt-2 max-h-24 list-disc space-y-0.5 overflow-y-auto ps-5 text-amber-800 dark:text-amber-300">
                    {preview.warnings.slice(0, 6).map((warning) => (
                      <li key={`${warning.row}-${warning.field}-${warning.message}`}>
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </StandardModalContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="تأكيد رفع الشجرة"
        description={
          preview
            ? `هيتضاف ${preview.summary.created} حساب ويتحدّث ${preview.summary.updated}. الحسابات اللي مش في الملف مش هتتمسح.${
                preview.openings.accounts > 0
                  ? ` وهيتسجل قيد أول المدة على الفرع الحالي (${preview.openings.accounts} حساب) ويعوّض القيد السابق.`
                  : ""
              }`
            : "تأكيد الرفع"
        }
        confirmLabel="رفع"
        pendingLabel="جارٍ الرفع..."
        intent="confirm"
        onConfirm={runImport}
      />
    </>
  );
}
