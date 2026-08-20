import {
  getValidatedActiveStoreId,
  requireStoreAccess,
} from "@/lib/auth/guards";
import { resolveAccountingReportStore } from "@/modules/accounting/lib/report-store";

export async function resolveAuthorizedAccountingReportStore(requested?: string): Promise<{
  selected: string;
  queryStoreId: string | undefined;
}> {
  const activeStoreId = await getValidatedActiveStoreId();
  const resolved = resolveAccountingReportStore({
    requested,
    activeStoreId,
  });
  if (resolved.queryStoreId) {
    await requireStoreAccess(resolved.queryStoreId);
  }
  return resolved;
}
