import { describe, expect, it } from "vitest";
import {
  ACCOUNTING_ALL_STORES,
  accountingReportEmptyScopeLabel,
  brandingStoreIdForAccountingReport,
  resolveAccountingReportStore,
} from "@/modules/accounting/lib/report-store";

const ACTIVE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resolveAccountingReportStore", () => {
  it("omits store filter for كل الفروع so org openings are not repeated", () => {
    expect(
      resolveAccountingReportStore({
        requested: ACCOUNTING_ALL_STORES,
        activeStoreId: ACTIVE,
      })
    ).toEqual({
      selected: ACCOUNTING_ALL_STORES,
      queryStoreId: undefined,
    });
  });

  it("keeps a branch UUID so the query includes that store plus org openings", () => {
    expect(
      resolveAccountingReportStore({
        requested: OTHER,
        activeStoreId: ACTIVE,
      })
    ).toEqual({ selected: OTHER, queryStoreId: OTHER });
  });

  it("falls back to the active store when the request is missing or invalid", () => {
    expect(
      resolveAccountingReportStore({ activeStoreId: ACTIVE })
    ).toEqual({ selected: ACTIVE, queryStoreId: ACTIVE });
    expect(
      resolveAccountingReportStore({
        requested: "not-a-store",
        activeStoreId: ACTIVE,
      })
    ).toEqual({ selected: ACTIVE, queryStoreId: ACTIVE });
  });
});

describe("accounting report branding", () => {
  it("drops store branding for org-wide reports", () => {
    expect(brandingStoreIdForAccountingReport(ACCOUNTING_ALL_STORES)).toBeUndefined();
    expect(brandingStoreIdForAccountingReport(ACTIVE)).toBe(ACTIVE);
  });

  it("labels empty states by scope", () => {
    expect(accountingReportEmptyScopeLabel(ACCOUNTING_ALL_STORES)).toBe("لكل الفروع");
    expect(accountingReportEmptyScopeLabel(ACTIVE)).toBe("للفرع المختار");
  });
});
