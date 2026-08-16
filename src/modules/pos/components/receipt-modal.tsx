"use client";

import { FileText, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ReceiptPrint,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import { ReceiptBrandingPreview } from "@/modules/pos/components/receipt-branding-preview";
import {
  buildWhatsAppReceiptUrl,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { printReceiptViaUsb } from "@/modules/pos/services/receipt-usb-printer.service";
import { DocumentPrintPreviewModal } from "@/components/print/document-print-preview-modal";
import { useState } from "react";

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptPayload | null;
}

export function ReceiptModal({ open, onOpenChange, receipt }: ReceiptModalProps) {
  const [a4Open, setA4Open] = useState(false);
  if (!receipt) return null;

  async function handleUsbPrint() {
    try {
      await printReceiptViaUsb(receipt!);
      toast.success("تم إرسال الإيصال لطابعة USB");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذرت طباعة الإيصال");
    }
  }

  function handleBrowserPrint() {
    setTimeout(() => triggerReceiptPrint(), 50);
  }

  function handleWhatsApp() {
    const url = buildWhatsAppReceiptUrl(receipt!);
    if (!url) {
      toast.error("رقم هاتف العميل غير صالح لواتساب");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-border/70 px-4 py-3">
            <DialogTitle className="flex items-center justify-between gap-2 pe-8">
              <span>ريسيت {receipt.orderNumber}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(92dvh-140px)] overflow-y-auto px-4 py-4">
            <ReceiptBrandingPreview receipt={receipt} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/70 p-4">
            <Button type="button" className="h-10 flex-1 rounded-xl" onClick={handleUsbPrint}>
              <Printer className="size-4" />
              طباعة USB
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl"
              onClick={handleWhatsApp}
              disabled={!receipt.customer?.phone}
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </Button>
            {receipt.orderId ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 rounded-xl"
                onClick={() => setA4Open(true)}
              >
                <FileText className="size-4" />
                فاتورة A4
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full rounded-xl sm:hidden"
              onClick={handleBrowserPrint}
            >
              طباعة المتصفح
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DocumentPrintPreviewModal
        open={a4Open}
        onOpenChange={setA4Open}
        href={receipt.orderId ? `/print/orders/${receipt.orderId}?embed=1` : null}
        title="فاتورة كاشير"
      />
      <ReceiptPrint receipt={receipt} />
    </>
  );
}
