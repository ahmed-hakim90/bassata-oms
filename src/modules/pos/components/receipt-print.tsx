"use client";

import { formatCurrency } from "@/lib/format";
import type { CartLine, PaymentMethod, PaymentSplit } from "@/lib/types";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ReceiptPrintProps {
  orderNumber: string;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  payments: PaymentSplit[];
  discount: number;
  total: number;
}

export function ReceiptPrint({
  orderNumber,
  lines,
  paymentMethod,
  payments,
  discount,
  total,
}: ReceiptPrintProps) {
  const { t } = useTranslation();
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return (
    <div id="CafeFlow-receipt" className="hidden print:block print:p-6">
      <div className="mx-auto max-w-xs font-mono text-sm">
        <p className="text-center font-bold">CafeFlow POS</p>
        <p className="text-center text-xs">{t("Order #")} {orderNumber}</p>
        <hr className="my-3 border-dashed" />
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.id}>
              <div className="flex justify-between gap-2">
                <span>
                  {line.name}
                  <br />
                  {line.quantity} {line.saleUnit ?? t("piece")} × {formatCurrency(line.unitPrice)}
                  {line.saleUnit ? `/${line.saleUnit}` : ""}
                </span>
                <span>{formatCurrency(line.lineTotal)}</span>
              </div>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-dashed" />
        <div className="flex justify-between">
          <span>{t("Subtotal")}</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between">
            <span>{t("Discount")}</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-bold">
          <span>{t("Total")} ({t(paymentMethod)})</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {payments.length > 1 ? (
          <div className="mt-2 space-y-1 text-xs">
            {payments.map((payment, index) => (
              <div key={`${payment.method}-${index}`} className="flex justify-between">
                <span>{payment.method}</span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-6 text-center text-xs">{t("Thank you!")}</p>
      </div>
    </div>
  );
}

export function triggerReceiptPrint() {
  window.print();
}

export function openCashDrawerHook() {
  // Hardware integration point — wire to ESC/POS or WebUSB in production.
  console.info("[CafeFlow] cash_drawer: open signal sent");
}
