"use client";

import { CheckCircle2, MessageCircle, Printer, ShoppingCart, Usb } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
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
      if (typeof document !== "undefined" && !document.getElementById("Velora-receipt")) {
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
        <DialogContent className="max-h-[min(94dvh,100%)] max-w-md overflow-hidden rounded-2xl p-0 max-sm:max-w-[calc(100%-0.75rem)] sm:max-w-md">
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

          <div className="max-h-[min(36dvh,280px)] overflow-y-auto overscroll-y-contain px-4 py-3 max-[390px]:max-h-[min(30dvh,220px)]">
            <ReceiptBrandingPreview receipt={receipt} />
          </div>

          <div className="border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
            <CompactActions className="w-full justify-end">
              <CompactAction
                label="طباعة الإيصال"
                icon={Printer}
                variant="default"
                alwaysLabeled
                onClick={handleBrowserPrint}
              />
              <CompactAction
                label="طباعة USB"
                icon={Usb}
                onClick={() => void handleUsbPrint()}
              />
              <CompactAction
                label="واتساب"
                icon={MessageCircle}
                disabled={!receipt.customer?.phone}
                onClick={onWhatsApp}
              />
              <CompactAction
                label="متابعة البيع"
                icon={ShoppingCart}
                variant="secondary"
                onClick={() => onOpenChange(false)}
              />
            </CompactActions>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiptPrint receipt={receipt} />
    </>
  );
}
