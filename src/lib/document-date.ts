/** Calendar date string YYYY-MM-DD used as invoice business date. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** UTC calendar "today" — matches existing app date pickers / ISO slice convention. */
export function todayDocumentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDocumentDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Reject future dates; today and any past date are allowed. */
export function normalizeDocumentDate(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  const date = raw || todayDocumentDate();
  if (!isValidDocumentDate(date)) {
    throw new Error("تاريخ الفاتورة غير صالح");
  }
  if (date > todayDocumentDate()) {
    throw new Error("تاريخ الفاتورة ماينفعش يكون في المستقبل");
  }
  return date;
}

/** Stable midday UTC so day bucketing stays on the chosen calendar date. */
export function documentDateToOccurredAt(documentDate: string): string {
  const date = normalizeDocumentDate(documentDate);
  return `${date}T12:00:00.000Z`;
}

export function orderBusinessAt(order: {
  document_date?: string | null;
  created_at: string;
}): string {
  if (order.document_date && isValidDocumentDate(order.document_date)) {
    return `${order.document_date}T12:00:00.000Z`;
  }
  return order.created_at;
}

export function purchaseBusinessAt(purchase: {
  document_date?: string | null;
  received_at?: string | null;
  created_at: string;
}): string {
  if (purchase.received_at) return purchase.received_at;
  if (purchase.document_date && isValidDocumentDate(purchase.document_date)) {
    return `${purchase.document_date}T12:00:00.000Z`;
  }
  return purchase.created_at;
}
