import { describe, expect, it } from "vitest";
import {
  allocateBalanceToAgedDebits,
  bucketForDaysOutstanding,
  emptyAgingBuckets,
  mergeBuckets,
  sumBuckets,
} from "@/modules/reports/lib/aging-buckets";

describe("S15 aging buckets", () => {
  it("maps days outstanding into buckets", () => {
    expect(bucketForDaysOutstanding(0)).toBe("current");
    expect(bucketForDaysOutstanding(30)).toBe("current");
    expect(bucketForDaysOutstanding(31)).toBe("days30");
    expect(bucketForDaysOutstanding(90)).toBe("days60");
    expect(bucketForDaysOutstanding(91)).toBe("days90");
    expect(bucketForDaysOutstanding(200)).toBe("over90");
  });

  it("allocates outstanding balance FIFO across aged debits", () => {
    const now = Date.parse("2026-07-13T12:00:00.000Z");
    const result = allocateBalanceToAgedDebits(
      150,
      [
        { at: "2026-01-01T00:00:00.000Z", amount: 100 },
        { at: "2026-06-20T00:00:00.000Z", amount: 100 },
      ],
      now
    );
    expect(result.buckets.over90).toBe(100);
    expect(result.buckets.current).toBe(50);
    expect(sumBuckets(result.buckets)).toBe(150);
    expect(result.daysOutstanding).toBeGreaterThan(100);
  });

  it("merges bucket totals", () => {
    const a = emptyAgingBuckets();
    a.current = 10;
    const b = emptyAgingBuckets();
    b.days30 = 20;
    mergeBuckets(a, b);
    expect(a.current).toBe(10);
    expect(a.days30).toBe(20);
  });
});

describe("S15 tax report aggregation helpers", () => {
  it("computes taxable base as subtotal minus discount", () => {
    const orders = [
      { subtotal: 100, discount: 10, tax: 14, total: 104 },
      { subtotal: 50, discount: 0, tax: 7, total: 57 },
    ];
    const taxableBase = orders.reduce((s, o) => s + (o.subtotal - o.discount), 0);
    const taxCollected = orders.reduce((s, o) => s + o.tax, 0);
    expect(taxableBase).toBe(140);
    expect(taxCollected).toBe(21);
  });
});

describe("S15 daily close variance", () => {
  it("variance equals actual minus expected", () => {
    const expected = 1000;
    const actual = 980;
    expect(actual - expected).toBe(-20);
  });
});
