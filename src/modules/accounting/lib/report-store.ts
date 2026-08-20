/**
 * Report store scope. A single branch query still includes org-level journals
 * (CoA openings). «كل الفروع» omits the store filter so those openings count once.
 */
export const ACCOUNTING_ALL_STORES = "all";

const STORE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ACCOUNTING_REPORT_STORE_HINT =
  "الفرع الواحد يشمل أرصدة الدليل على مستوى الشركة. «كل الفروع» هو الإجمالي المؤسسي من غير تكرار الأرصدة دي.";

export function isAccountingAllStores(value: string | undefined): boolean {
  return value === ACCOUNTING_ALL_STORES;
}

export function resolveAccountingReportStore(input: {
  requested?: string;
  activeStoreId: string;
}): { selected: string; queryStoreId: string | undefined } {
  if (input.requested === ACCOUNTING_ALL_STORES) {
    return { selected: ACCOUNTING_ALL_STORES, queryStoreId: undefined };
  }
  if (input.requested && STORE_ID_RE.test(input.requested)) {
    return { selected: input.requested, queryStoreId: input.requested };
  }
  return {
    selected: input.activeStoreId,
    queryStoreId: input.activeStoreId,
  };
}

/** Excel/print branding: no store row when the report is org-wide. */
export function brandingStoreIdForAccountingReport(
  selected: string
): string | undefined {
  return isAccountingAllStores(selected) ? undefined : selected;
}

export function accountingReportEmptyScopeLabel(selected: string): string {
  return isAccountingAllStores(selected) ? "لكل الفروع" : "للفرع المختار";
}
