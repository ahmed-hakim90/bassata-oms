"use server";

import {
  requireFeature,
  requirePermissionOrRole,
} from "@/lib/auth/guards";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { resolveAuthorizedAccountingReportStore } from "@/modules/accounting/actions/resolve-report-store";
import {
  getAccountLedger,
  type AccountLedgerResult,
} from "@/modules/accounting/services/account-ledger.service";
import { listGlAccountsFlat } from "@/modules/accounting/services/gl-account.service";
import type { GlAccount, Store } from "@/lib/types";

export async function getAccountLedgerPageData(input?: {
  accountId?: string;
  from?: string;
  to?: string;
  storeId?: string;
}): Promise<{
  result: AccountLedgerResult | null;
  accounts: GlAccount[];
  stores: Store[];
  storeId: string;
  currency: string;
  from: string;
  to: string;
  accountId: string | null;
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
  const from = input?.from || monthStart;
  const to = input?.to || todayStr;

  const [accounts, stores, org] = await Promise.all([
    listGlAccountsFlat({ activeOnly: true, postableOnly: true }),
    storeRepo.listStores(),
    orgRepo.getOrganization(),
  ]);

  const accountId = input?.accountId || accounts[0]?.id || null;
  const result =
    accountId != null
      ? await getAccountLedger({
          accountId,
          from,
          to,
          storeId: queryStoreId,
        })
      : null;

  return {
    result,
    accounts,
    stores,
    storeId: selected,
    currency: org.currency,
    from,
    to,
    accountId,
  };
}
