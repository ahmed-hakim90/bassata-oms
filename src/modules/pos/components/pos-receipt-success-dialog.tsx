"use client";

import { CheckCircle2, MessageCircle, Printer, Usb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  ReceiptPrint,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { ReceiptBrandingPreview } from "@/modules/pos/components/receipt-branding-preview";
import { type ReceiptPayload } from "@/modules/pos/services/receipt-format.service";

interface PosReceiptSuccessDialogProps {
  open: boolean;
  receipt: ReceiptPayload | null;
  onOpenChange: (open: boolean) => void;
  onUsbPrint: () => void | Promise<void>;
  onBrowserPrint?: () => void;
  onWhatsApp: () => void;
}

export function PosReceiptSuccessDialog({
  open,
  receipt,
  onOpenChange,
  onUsbPrint,
  onBrowserPrint,
  onWhatsApp,
}: PosReceiptSuccessDialogProps) {
  if (!receipt) return null;

  const currency = receipt.branding.currency;

  function handleBrowserPrint() {
    try {
      if (onBrowserPrint) {
        onBrowserPrint();
        return;
      }
      if (typeof document !== "undefined" && !document.getElementById("CafeFlow-receipt")) {
        toast.error("تعذرت طباعة الإيصال — الإيصال غير جاهز");
        return;
      }
      // Defer so the print stylesheet applies after paint.
      window.setTimeout(() => triggerReceiptPrint(), 100);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت طباعة الإيصال");
    }
  }

  async function handleUsbPrint() {
    try {
      await onUsbPrint();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت طباعة الإيصال");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-hidden rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="space-y-2 border-b border-border/70 px-4 py-4 text-start">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </div>
            <DialogTitle className="text-lg">تم حفظ الطلب</DialogTitle>
            <DialogDescription className="text-sm">
              الطلب {receipt.orderNumber} · {formatCurrency(receipt.total, currency)}
              {receipt.customer?.name ? ` · ${receipt.customer.name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(42dvh,320px)] overflow-y-auto px-4 py-3">
            <ReceiptBrandingPreview receipt={receipt} />
          </div>

          <div className="grid gap-2 border-t border-border/70 p-4">
            <Button
              type="button"
              className="h-14 rounded-2xl text-base font-semibold"
              onClick={handleBrowserPrint}
            >
              <Printer className="size-5" />
              طباعة الإيصال
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl text-sm font-semibold"
                onClick={() => void handleUsbPrint()}
              >
                <Usb className="size-4" />
                طباعة USB
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl text-sm font-semibold"
                onClick={onWhatsApp}
                disabled={!receipt.customer?.phone}
              >
                <MessageCircle className="size-4" />
                واتساب
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-xl text-sm"
              onClick={() => onOpenChange(false)}
            >
              متابعة البيع
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiptPrint receipt={receipt} />
    </>
  );
}
