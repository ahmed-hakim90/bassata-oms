"use server";

import {
  requireFeature,
  requirePermissionOrRole,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { resolveAuthorizedAccountingReportStore } from "@/modules/accounting/actions/resolve-report-store";
import {
  getTrialBalance,
  type TrialBalanceResult,
} from "@/modules/accounting/services/trial-balance.service";
import type { Store } from "@/lib/types";

export async function getTrialBalancePageData(input?: {
  from?: string;
  to?: string;
  storeId?: string;
}): Promise<{
  result: TrialBalanceResult;
  stores: Store[];
  storeId: string;
  currency: string;
}> {
  await requireFeature("general_ledger");
  await requirePermissionOrRole("gl_view", ["owner", "manager"]);

  const { selected, queryStoreId } = await resolveAuthorizedAccountingReportStore(
    input?.storeId
  );
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [result, stores, org] = await Promise.all([
    getTrialBalance({
      from: input?.from || monthStart,
      to: input?.to || todayStr,
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
