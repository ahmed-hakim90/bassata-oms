import { describe, expect, it } from "vitest";
import {
  groupReorderLinesByWarehouseAndSupplier,
  resolveLastSupplierByProduct,
} from "@/modules/purchases/services/purchase.service";

describe("resolveLastSupplierByProduct", () => {
  it("picks the newest received supplier per product", () => {
    const result = resolveLastSupplierByProduct({
      productIds: ["p1", "p2"],
      validSupplierIds: new Set(["s-a", "s-b"]),
      purchases: [
        {
          supplierId: "s-a",
          status: "received",
          receivedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          lines: [{ productId: "p1" }, { productId: "p2" }],
        },
        {
          supplierId: "s-b",
          status: "received",
          receivedAt: "2026-06-01T00:00:00.000Z",
          createdAt: "2026-06-01T00:00:00.000Z",
          lines: [{ productId: "p1" }],
        },
        {
          supplierId: "s-b",
          status: "draft",
          receivedAt: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          lines: [{ productId: "p2" }],
        },
      ],
    });

    expect(result.get("p1")).toBe("s-b");
    expect(result.get("p2")).toBe("s-a");
  });

  it("ignores suppliers that no longer exist", () => {
    const result = resolveLastSupplierByProduct({
      productIds: ["p1"],
      validSupplierIds: new Set(["s-alive"]),
      purchases: [
        {
          supplierId: "s-deleted",
          status: "received",
          receivedAt: "2026-06-01T00:00:00.000Z",
          createdAt: "2026-06-01T00:00:00.000Z",
          lines: [{ productId: "p1" }],
        },
        {
          supplierId: "s-alive",
          status: "received",
          receivedAt: "2025-01-01T00:00:00.000Z",
          createdAt: "2025-01-01T00:00:00.000Z",
          lines: [{ productId: "p1" }],
        },
      ],
    });

    expect(result.get("p1")).toBe("s-alive");
  });
});

describe("groupReorderLinesByWarehouseAndSupplier", () => {
  it("splits one warehouse into supplier drafts and falls back when history is missing", () => {
    const buckets = groupReorderLinesByWarehouseAndSupplier({
      fallbackSupplierId: "s-fallback",
      lastSupplierByProduct: new Map([
        ["p1", "s-milk"],
        ["p2", "s-meat"],
      ]),
      lines: [
        { productId: "p1", warehouseId: "w1", quantity: 10 },
        { productId: "p2", warehouseId: "w1", quantity: 5 },
        { productId: "p3", warehouseId: "w1", quantity: 2 },
        { productId: "p4", warehouseId: "w2", quantity: 3 },
        { productId: "bad", warehouseId: "", quantity: 9 },
      ],
    });

    expect(buckets.size).toBe(4);
    expect(buckets.get("w1::s-milk")?.lines.map((l) => l.productId)).toEqual(["p1"]);
    expect(buckets.get("w1::s-meat")?.lines.map((l) => l.productId)).toEqual(["p2"]);
    expect(buckets.get("w1::s-fallback")?.lines.map((l) => l.productId)).toEqual(["p3"]);
    expect(buckets.get("w2::s-fallback")?.lines.map((l) => l.productId)).toEqual(["p4"]);
  });
});
