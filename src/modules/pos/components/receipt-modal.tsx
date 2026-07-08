"use client";

import { MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  ReceiptPrint,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import {
  buildWhatsAppReceiptUrl,
  getReceiptSubtotal,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";
import { printReceiptViaUsb } from "@/modules/pos/services/receipt-usb-printer.service";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptPayload | null;
}

export function ReceiptModal({ open, onOpenChange, receipt }: ReceiptModalProps) {
  const { t } = useTranslation();

  if (!receipt) return null;

  const subtotal = getReceiptSubtotal(receipt);
  const currency = receipt.branding.currency;

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
            <div className="mx-auto w-full max-w-[72mm] rounded-xl border border-dashed border-border bg-muted/30 p-3 font-mono text-[11px] leading-snug">
              <p className="text-center font-bold">{receipt.branding.orgName || "POS"}</p>
              {receipt.branding.storeName ? (
                <p className="text-center text-xs">{receipt.branding.storeName}</p>
              ) : null}
              {receipt.branding.storePhone ? (
                <p className="text-center text-xs" dir="ltr">
                  {receipt.branding.storePhone}
                </p>
              ) : null}
              <p className="mt-2 text-center text-xs">
                {t("Order #")} {receipt.orderNumber}
              </p>
              {receipt.customer ? (
                <p className="text-center text-xs">
                  {t("Customer")}: {receipt.customer.name}
                </p>
              ) : null}
              <hr className="my-3 border-dashed" />
              <ul className="space-y-2">
                {receipt.lines.map((line) => (
                  <li key={line.id}>
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0">
                        {line.name}
                        <br />
                        {line.quantity} × {formatCurrency(line.unitPrice, currency)}
                      </span>
                      <span className="shrink-0">{formatCurrency(line.lineTotal, currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <hr className="my-3 border-dashed" />
              <div className="flex justify-between">
                <span>{t("Subtotal")}</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {receipt.discount > 0 ? (
                <div className="flex justify-between">
                  <span>{t("Discount")}</span>
                  <span>-{formatCurrency(receipt.discount, currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold">
                <span>
                  {t("Total")} ({t(receipt.paymentMethod)})
                </span>
                <span>{formatCurrency(receipt.total, currency)}</span>
              </div>
              {receipt.payments.length > 1 ? (
                <div className="mt-2 space-y-1 text-xs">
                  {receipt.payments.map((payment, index) => (
                    <div key={`${payment.method}-${index}`} className="flex justify-between">
                      <span>{payment.method}</span>
                      <span>{formatCurrency(payment.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
      <ReceiptPrint receipt={receipt} />
    </>
  );
}
