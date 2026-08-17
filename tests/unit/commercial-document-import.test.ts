import { describe, expect, it } from "vitest";
import {
  canImportPurchaseOrderStatus,
  canImportSalesSource,
  salesSourceLockStatus,
} from "@/lib/commercial-document-import";
import { remainingPurchaseLineQty } from "@/modules/purchases/lib/remaining-qty";

describe("commercial document import eligibility", () => {
  it("allows sent and partial purchase orders only", () => {
    expect(canImportPurchaseOrderStatus("sent")).toBe(true);
    expect(canImportPurchaseOrderStatus("partial_invoiced")).toBe(true);
    expect(canImportPurchaseOrderStatus("draft")).toBe(false);
    expect(canImportPurchaseOrderStatus("invoiced")).toBe(false);
    expect(canImportPurchaseOrderStatus("received")).toBe(false);
  });

  it("allows sent quotations and confirmed sales orders only", () => {
    expect(canImportSalesSource("quotation", "sent")).toBe(true);
    expect(canImportSalesSource("quotation", "draft")).toBe(false);
    expect(canImportSalesSource("quotation", "accepted")).toBe(false);
    expect(canImportSalesSource("sales_order", "confirmed")).toBe(true);
    expect(canImportSalesSource("sales_order", "draft")).toBe(false);
    expect(canImportSalesSource("sales_invoice", "draft")).toBe(false);
  });

  it("locks imported sales sources to the correct status", () => {
    expect(salesSourceLockStatus("quotation")).toBe("accepted");
    expect(salesSourceLockStatus("sales_order")).toBe("invoiced");
  });

  it("computes remaining purchase qty after partial allocation", () => {
    expect(remainingPurchaseLineQty(10, 4)).toBe(6);
    expect(remainingPurchaseLineQty(10, 10)).toBe(0);
    expect(remainingPurchaseLineQty(10, 12)).toBe(0);
  });

  it("maps remaining vs ordered into purchase-order reopen status", () => {
    const statusFor = (ordered: number, remaining: number) =>
      remaining <= 0 ? "invoiced" : remaining < ordered ? "partial_invoiced" : "sent";
    expect(statusFor(10, 10)).toBe("sent");
    expect(statusFor(10, 4)).toBe("partial_invoiced");
    expect(statusFor(10, 0)).toBe("invoiced");
  });
});
