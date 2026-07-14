import {
  PRICE_LIST_PRINT_STORAGE_KEY,
  type PriceListPrintPayload,
} from "@/modules/price-lists/lib/formats";
import { savePrintJob, loadPrintJob } from "@/lib/print/print-job-storage";

/** Simple validation: payload must be an object with rows array. */
function isPriceListPrintPayload(value: unknown): value is PriceListPrintPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as PriceListPrintPayload;
  return Array.isArray(payload.rows);
}

/** Persist print data for a new tab (sessionStorage is NOT shared across windows). */
export function savePriceListPrintPayload(payload: PriceListPrintPayload): void {
  savePrintJob(PRICE_LIST_PRINT_STORAGE_KEY, payload);
}

/** Load and validate price list print payload from storage. */
export function loadPriceListPrintPayload(): PriceListPrintPayload | null {
  return loadPrintJob(PRICE_LIST_PRINT_STORAGE_KEY, isPriceListPrintPayload);
}
