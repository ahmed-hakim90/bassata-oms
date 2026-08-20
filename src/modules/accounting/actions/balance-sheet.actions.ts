"use server";

import {
  requireFeature,
  requirePermissionOrRole,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { resolveAuthorizedAccountingReportStore } from "@/modules/accounting/actions/resolve-report-store";
import {
  getBalanceSheet,
  type BalanceSheetResult,
} from "@/modules/accounting/services/balance-sheet.service";
import type { Store } from "@/lib/types";

export async function getBalanceSheetPageData(input?: {
  asOf?: string;
  storeId?: string;
}): Promise<{
  result: BalanceSheetResult;
  stores: Store[];
  storeId: string;
  currency: string;
}> {
  await requireFeature("general_ledger");
  await requirePermissionOrRole("gl_view", ["owner", "manager"]);

  const { selected, queryStoreId } = await resolveAuthorizedAccountingReportStore(
    input?.storeId
  );
  const todayStr = new Date().toISOString().slice(0, 10);

  const [result, stores, org] = await Promise.all([
    getBalanceSheet({
      asOf: input?.asOf || todayStr,
      storeId: queryStoreId,
    }),
    storeRepo.listStores(),
    orgRepo.getOrganization(),
  ]);

  return {
    result,
    stores,
    storeId: selected,
    currency: org.currency,
  };
}
