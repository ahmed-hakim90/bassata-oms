import { describe, expect, it } from "vitest";
import {
  agingBucketsToChartRows,
  emptyAgingBuckets,
} from "@/modules/reports/lib/aging-buckets";

describe("agingBucketsToChartRows", () => {
  it("maps bucket keys to ops labels in order", () => {
    const buckets = emptyAgingBuckets();
    buckets.current = 100;
    buckets.days30 = 50;
    buckets.over90 = 25;
    expect(agingBucketsToChartRows(buckets)).toEqual([
      { label: "0–30", amount: 100 },
      { label: "31–60", amount: 50 },
      { label: "61–90", amount: 0 },
      { label: "91–120", amount: 0 },
      { label: "120+", amount: 25 },
    ]);
  });
});
