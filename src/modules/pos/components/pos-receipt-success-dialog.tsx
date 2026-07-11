"use client";

import { CheckCircle2, MessageCircle, Printer, Usb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  ReceiptPrint,
  triggerReceiptPrint,
} from "@/modules/pos/components/receipt-print";
import {
  getReceiptSubtotal,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";

interface PosReceiptSuccessDialogProps {
  open: boolean;
  receipt: ReceiptPayload | null;
  onOpenChange: (open: boolean) => void;
  onUsbPrint: () => void;
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
  const { t } = useTranslation();

  if (!receipt) return null;

  const subtotal = getReceiptSubtotal(receipt);
  const currency = receipt.branding.currency;

  function handleBrowserPrint() {
    if (onBrowserPrint) {
      onBrowserPrint();
      return;
    }
    // Defer so the print stylesheet applies after paint.
    window.setTimeout(() => triggerReceiptPrint(), 100);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-hidden rounded-2xl p-0 sm:max-w-md">
          <DialogHeader className="space-y-2 border-b border-border/70 px-4 py-4 text-start">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle>تم حفظ الطلب</DialogTitle>
            <DialogDescription>
              الطلب {receipt.orderNumber} · {formatCurrency(receipt.total, currency)}
              {receipt.customer?.name ? ` · ${receipt.customer.name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(42dvh,320px)] overflow-y-auto px-4 py-3">
            <div className="mx-auto w-full max-w-[72mm] rounded-xl border border-dashed border-border bg-muted/30 p-3 font-mono text-[11px] leading-snug text-foreground">
              <p className="text-center font-bold">
                {receipt.branding.orgName || "CafeFlow POS"}
              </p>
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
                      <span className="shrink-0">
                        {formatCurrency(line.lineTotal, currency)}
                      </span>
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
            </div>
          </div>

          <div className="grid gap-2 border-t border-border/70 p-4">
            <Button
              type="button"
              className="h-14 rounded-xl text-base font-semibold"
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
                onClick={onUsbPrint}
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
              className="h-11 rounded-xl"
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
