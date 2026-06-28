import { formatCurrency, formatDateTime } from "@/lib/format";
import type { CartLine, Customer, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface ReceiptPayload {
  orderNumber: string;
  createdAt: string;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  payments: PaymentSplit[];
  discount: number;
  total: number;
  customer: Pick<Customer, "name" | "phone"> | null;
  branding: ReportBranding;
}

const RECEIPT_LINE_WIDTH = 42;

function money(amount: number, currency: string) {
  return formatCurrency(amount, currency);
}

function padColumns(left: string, right: string, width = RECEIPT_LINE_WIDTH) {
  const safeLeft = left.trim();
  const safeRight = right.trim();
  const gap = Math.max(1, width - safeLeft.length - safeRight.length);
  return `${safeLeft}${" ".repeat(gap)}${safeRight}`;
}

function divider(char = "-") {
  return char.repeat(RECEIPT_LINE_WIDTH);
}

function receiptTitle(payload: ReceiptPayload) {
  return payload.branding.orgName || "CafeFlow POS";
}

export function getReceiptSubtotal(payload: Pick<ReceiptPayload, "lines">) {
  return payload.lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasInternationalPrefix = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || /^0+$/.test(digits)) return null;

  if (hasInternationalPrefix) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("20") || digits.startsWith("966")) return digits;
  if (digits.startsWith("01") && digits.length === 11) return `2${digits}`;
  if (digits.startsWith("05") && digits.length === 10) return `966${digits.slice(1)}`;

  return digits;
}

export function buildWhatsAppReceiptUrl(payload: ReceiptPayload): string | null {
  const phone = normalizeWhatsAppPhone(payload.customer?.phone);
  if (!phone) return null;

  return `https://wa.me/${phone}?text=${encodeURIComponent(formatReceiptForWhatsApp(payload))}`;
}

export function formatReceiptForWhatsApp(payload: ReceiptPayload) {
  const currency = payload.branding.currency;
  const subtotal = getReceiptSubtotal(payload);
  const lines = [
    `*${receiptTitle(payload)}*`,
    payload.branding.storeName ? payload.branding.storeName : null,
    payload.branding.storePhone ? `Tel: ${payload.branding.storePhone}` : null,
    payload.branding.receiptHeader,
    "",
    `Order #${payload.orderNumber}`,
    formatDateTime(payload.createdAt),
    payload.customer ? `Customer: ${payload.customer.name}` : null,
    divider(),
    ...payload.lines.flatMap((line) => [
      line.name,
      `${line.quantity} ${line.saleUnit ?? "pc"} x ${money(line.unitPrice, currency)} = ${money(
        line.lineTotal,
        currency
      )}`,
    ]),
    divider(),
    padColumns("Subtotal", money(subtotal, currency)),
    payload.discount > 0 ? padColumns("Discount", `-${money(payload.discount, currency)}`) : null,
    padColumns("Total", money(payload.total, currency)),
    "",
    payload.payments.length > 1
      ? "Payments"
      : `Payment: ${payload.paymentMethod}`,
    ...payload.payments.map((payment) =>
      padColumns(payment.method, money(payment.amount, currency))
    ),
    "",
    payload.branding.receiptFooter || "Thank you!",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function formatReceiptForEscPos(payload: ReceiptPayload) {
  const currency = payload.branding.currency;
  const subtotal = getReceiptSubtotal(payload);
  const lines = [
    receiptTitle(payload),
    payload.branding.storeName,
    payload.branding.storeAddress,
    payload.branding.storePhone,
    payload.branding.receiptHeader,
    divider("="),
    `Order #${payload.orderNumber}`,
    formatDateTime(payload.createdAt),
    payload.customer ? `Customer: ${payload.customer.name}` : null,
    divider(),
    ...payload.lines.flatMap((line) => [
      line.name,
      padColumns(
        `${line.quantity} ${line.saleUnit ?? "pc"} x ${money(line.unitPrice, currency)}`,
        money(line.lineTotal, currency)
      ),
    ]),
    divider(),
    padColumns("Subtotal", money(subtotal, currency)),
    payload.discount > 0 ? padColumns("Discount", `-${money(payload.discount, currency)}`) : null,
    padColumns("Total", money(payload.total, currency)),
    "",
    payload.payments.length > 1 ? "Payments" : `Payment: ${payload.paymentMethod}`,
    ...payload.payments.map((payment) =>
      padColumns(payment.method, money(payment.amount, currency))
    ),
    "",
    payload.branding.receiptFooter || "Thank you!",
    "\n\n",
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

export function buildEscPosReceiptBytes(payload: ReceiptPayload): Uint8Array {
  const encoder = new TextEncoder();
  const init = [0x1b, 0x40];
  const alignCenter = [0x1b, 0x61, 0x01];
  const alignLeft = [0x1b, 0x61, 0x00];
  const cut = [0x1d, 0x56, 0x42, 0x00];
  const body = encoder.encode(formatReceiptForEscPos(payload));

  return new Uint8Array([...init, ...alignCenter, ...alignLeft, ...body, ...cut]);
}
