"use client";

import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getReceiptSubtotal,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";

interface ReceiptPrintProps {
  receipt: ReceiptPayload;
}

export function ReceiptPrint({ receipt }: ReceiptPrintProps) {
  const { t } = useTranslation();
  const subtotal = getReceiptSubtotal(receipt);
  const { branding, customer, discount, lines, orderNumber, paymentMethod, payments, total } =
    receipt;
  return (
    <div
      id="Velora-receipt"
      data-print-layout="receipt"
      className="hidden print:block print:bg-white print:p-0"
    >
      <div className="mx-auto w-[72mm] max-w-[72mm] font-mono text-[11px] leading-snug text-black">
        <p className="text-center font-bold">{branding.orgName || "Velora"}</p>
        {branding.storeName ? (
          <p className="text-center text-xs">{branding.storeName}</p>
        ) : null}
        {branding.storeAddress ? (
          <p className="text-center text-xs whitespace-pre-wrap">{branding.storeAddress}</p>
        ) : null}
        {branding.storePhone ? (
          <p className="text-center text-xs">{branding.storePhone}</p>
        ) : null}
        {branding.receiptHeader ? (
          <p className="mt-2 whitespace-pre-wrap text-center text-xs">{branding.receiptHeader}</p>
        ) : null}
        <p className="mt-2 text-center text-xs">
          {t("Order #")} {orderNumber}
        </p>
        {customer ? (
          <p className="text-center text-xs">
            {t("Customer")}: {customer.name}
          </p>
        ) : null}
        <hr className="my-3 border-dashed" />
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.id}>
              <div className="flex justify-between gap-2">
                <span>
                  {line.name}
                  <br />
                  {line.quantity} {line.saleUnit ?? t("piece")} ×{" "}
                  {formatCurrency(line.unitPrice, branding.currency)}
                  {line.saleUnit ? `/${line.saleUnit}` : ""}
                </span>
                <span>{formatCurrency(line.lineTotal, branding.currency)}</span>
              </div>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-dashed" />
        <div className="flex justify-between">
          <span>{t("Subtotal")}</span>
          <span>{formatCurrency(subtotal, branding.currency)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between">
            <span>{t("Discount")}</span>
            <span>-{formatCurrency(discount, branding.currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-bold">
          <span>{t("Total")} ({t(paymentMethod)})</span>
          <span>{formatCurrency(total, branding.currency)}</span>
        </div>
        {payments.length > 1 ? (
          <div className="mt-2 space-y-1 text-xs">
            {payments.map((payment, index) => (
              <div key={`${payment.method}-${index}`} className="flex justify-between">
                <span>{t(payment.method)}</span>
                <span>{formatCurrency(payment.amount, branding.currency)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-6 whitespace-pre-wrap text-center text-xs">
          {branding.receiptFooter || t("Thank you!")}
        </p>
      </div>
    </div>
  );
}

export function triggerReceiptPrint() {
  // Ensure receipt print styles apply after the current paint.
  requestAnimationFrame(() => {
    window.setTimeout(() => window.print(), 50);
  });
}

export function openCashDrawerHook() {
  // Hardware integration point — wire to ESC/POS or WebUSB in production.
  console.info("[Velora] cash_drawer: open signal sent");
}
