"use client";

import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getReceiptSubtotal,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";

/** Shared branded receipt body for modal + success preview (matches print/ESC/POS fields). */
export function ReceiptBrandingPreview({ receipt }: { receipt: ReceiptPayload }) {
  const { t } = useTranslation();
  const subtotal = getReceiptSubtotal(receipt);
  const { branding, customer, discount, lines, orderNumber, paymentMethod, payments, total } =
    receipt;
  const currency = branding.currency;

  return (
    <div className="mx-auto w-full max-w-[72mm] rounded-xl border border-dashed border-border bg-muted/30 p-3 font-mono text-[11px] leading-snug text-foreground">
      <p className="text-center font-bold">{branding.orgName || "Velora"}</p>
      {branding.storeName ? <p className="text-center text-xs">{branding.storeName}</p> : null}
      {branding.storeAddress ? (
        <p className="text-center text-xs whitespace-pre-wrap">{branding.storeAddress}</p>
      ) : null}
      {branding.storePhone ? (
        <p className="text-center text-xs" dir="ltr">
          {branding.storePhone}
        </p>
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
              <span className="min-w-0">
                {line.name}
                <br />
                {line.quantity} {line.saleUnit ?? t("piece")} ×{" "}
                {formatCurrency(line.unitPrice, currency)}
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
      {discount > 0 ? (
        <div className="flex justify-between">
          <span>{t("Discount")}</span>
          <span>-{formatCurrency(discount, currency)}</span>
        </div>
      ) : null}
      <div className="flex justify-between font-bold">
        <span>
          {t("Total")} ({t(paymentMethod)})
        </span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
      {payments.length > 1 ? (
        <div className="mt-2 space-y-1 text-xs">
          {payments.map((payment, index) => (
            <div key={`${payment.method}-${index}`} className="flex justify-between">
              <span>{t(payment.method)}</span>
              <span>{formatCurrency(payment.amount, currency)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-6 whitespace-pre-wrap text-center text-xs">
        {branding.receiptFooter || t("Thank you!")}
      </p>
    </div>
  );
}
