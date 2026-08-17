import type { Order, PurchaseInvoice } from "@/lib/types";

/** Purchase orders that still have remaining qty to pull into a purchase invoice. */
export function canImportPurchaseOrderStatus(
  status: PurchaseInvoice["status"]
): boolean {
  return status === "sent" || status === "partial_invoiced";
}

/** Sent quotations / confirmed sales orders that can be pulled into a sales invoice. */
export function canImportSalesSource(
  kind: Order["document_kind"],
  status: Order["document_status"]
): boolean {
  if (kind === "quotation") return status === "sent";
  if (kind === "sales_order") return status === "confirmed";
  return false;
}

export function salesSourceLockStatus(
  kind: "quotation" | "sales_order"
): NonNullable<Order["document_status"]> {
  return kind === "quotation" ? "accepted" : "invoiced";
}
