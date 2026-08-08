import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getAccountLedgerPageData } from "@/modules/accounting/actions/account-ledger.actions";
import { AccountLedgerPage } from "@/modules/accounting/components/account-ledger-page";

interface LedgerRouteProps {
  searchParams: Promise<{
    accountId?: string;
    from?: string;
    to?: string;
    storeId?: string;
  }>;
}

export default async function AccountLedgerRoute({ searchParams }: LedgerRouteProps) {
  try {
    const params = await searchParams;
    const data = await getAccountLedgerPageData({
      accountId: params.accountId,
      from: params.from,
      to: params.to,
      storeId: params.storeId,
    });
    return <AccountLedgerPage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية لدفتر الأستاذ"
          description="فعّل دفتر الأستاذ العام من الإعدادات، أو اطلب صلاحية العرض من المالك."
        />
      );
    }
    throw error;
  }
}
