"use server";

import {
  getValidatedActiveStoreId,
  requireFeature,
  requirePermissionOrRole,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  getIncomeStatement,
  type IncomeStatementResult,
} from "@/modules/accounting/services/income-statement.service";
import type { Store } from "@/lib/types";

export async function getIncomeStatementPageData(input?: {
  from?: string;
  to?: string;
  storeId?: string;
}): Promise<{
  result: IncomeStatementResult;
  stores: Store[];
  storeId: string;
  currency: string;
}> {
  await requireFeature("general_ledger");
  await requirePermissionOrRole("gl_view", ["owner", "manager"]);

  const activeStoreId = await getValidatedActiveStoreId();
  const storeId = input?.storeId || activeStoreId;
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [result, stores, org] = await Promise.all([
    getIncomeStatement({
      from: input?.from || monthStart,
      to: input?.to || todayStr,
      storeId,
    }),
    storeRepo.listStores(),
    orgRepo.getOrganization(),
  ]);

  return {
    result,
    stores,
    storeId,
    currency: org.currency,
  };
}
