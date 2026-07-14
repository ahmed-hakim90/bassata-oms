import { formatCurrency, formatDateTime } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import type { ReportBranding } from "@/modules/reports/core/report-context";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدي",
  card: "كارت",
  wallet: "محفظة",
  credit: "آجل",
  other: "أخرى",
};

export interface ReceiptPrintServerProps {
  /** e.g. ريسيت / ريسيت مبيعات / ريسيت مشتريات */
  documentLabel?: string;
  orderNumber: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  subtotal: number;
  discount: number;
  promoDiscount?: number;
  tax: number;
  total: number;
  paymentStatus?: "paid" | "unpaid" | "partial" | null;
  payments?: Array<{
    id: string;
    method: PaymentMethod;
    amount: number;
  }>;
  /** Partner line — عميل / مورد */
  partyLabel?: string;
  partyName?: string | null;
  /** Extra meta lines under the header (e.g. warehouse). */
  metaLines?: string[];
  /** Show draft watermark/label on the slip. */
  isDraft?: boolean;
  branding: ReportBranding;
}

/**
 * Shared thermal receipt (72mm). Used by POS sales, wholesale sales invoices, and purchases.
 */
export function ReceiptPrintServer({
  documentLabel = "ريسيت",
  orderNumber,
  createdAt,
  items,
  subtotal,
  discount,
  promoDiscount,
  tax,
  total,
  paymentStatus = null,
  payments = [],
  partyLabel = "العميل",
  partyName,
  metaLines,
  isDraft = false,
  branding,
}: ReceiptPrintServerProps) {
  const primaryPayment = payments[0]?.method ?? null;

  return (
    <main
      data-print-layout="receipt"
      className="mx-auto w-[72mm] max-w-[72mm] bg-white p-3 font-mono text-[11px] leading-snug text-black print:p-0"
      dir="rtl"
    >
      <header className="text-center">
        <p className="text-sm font-bold">{branding.orgName || "Velora"}</p>
        {branding.storeName ? <p>{branding.storeName}</p> : null}
        {branding.storeAddress ? <p>{branding.storeAddress}</p> : null}
        {branding.storePhone ? <p dir="ltr">{branding.storePhone}</p> : null}
        {branding.receiptHeader ? (
          <p className="mt-2 whitespace-pre-wrap">{branding.receiptHeader}</p>
        ) : null}
        <p className="mt-2 font-semibold">
          {documentLabel} #{orderNumber}
        </p>
        {isDraft ? (
          <p className="font-bold tracking-wide">*** مسودة — غير نهائية ***</p>
        ) : null}
        <p>{formatDateTime(createdAt)}</p>
        {partyName ? (
          <p>
            {partyLabel}: {partyName}
          </p>
        ) : null}
        {metaLines?.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </header>

      <hr className="my-3 border-dashed border-black" />

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex justify-between gap-2">
              <span className="min-w-0">
                {item.productName}
                <br />
                <span dir="ltr">
                  {item.quantity} × {formatCurrency(item.unit_price, branding.currency)}
                </span>
              </span>
              <span className="shrink-0">
                {formatCurrency(item.line_total, branding.currency)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <hr className="my-3 border-dashed border-black" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>الإجمالي قبل الخصم</span>
          <span>{formatCurrency(subtotal, branding.currency)}</span>
        </div>
        {discount > 0 ? (
          <div className="flex justify-between">
            <span>
              خصم
              {(promoDiscount ?? 0) > 0 ? " (يتضمن عرض)" : ""}
            </span>
            <span>-{formatCurrency(discount, branding.currency)}</span>
          </div>
        ) : null}
        {tax > 0 ? (
          <div className="flex justify-between">
            <span>ضريبة</span>
            <span>{formatCurrency(tax, branding.currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-sm font-bold">
          <span>الإجمالي</span>
          <span>{formatCurrency(total, branding.currency)}</span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {paymentStatus === "unpaid" ? (
          <div className="flex justify-between font-semibold">
            <span>حالة الدفع</span>
            <span>غير مدفوع</span>
          </div>
        ) : primaryPayment ? (
          <div className="flex justify-between">
            <span>الدفع</span>
            <span>{PAYMENT_LABELS[primaryPayment]}</span>
          </div>
        ) : null}
        {payments.length > 1
          ? payments.map((payment) => (
              <div key={payment.id} className="flex justify-between">
                <span>{PAYMENT_LABELS[payment.method]}</span>
                <span>{formatCurrency(payment.amount, branding.currency)}</span>
              </div>
            ))
          : null}
      </div>

      <p className="mt-6 whitespace-pre-wrap text-center">
        {branding.receiptFooter || "شكراً لزيارتكم"}
      </p>
    </main>
  );
}
