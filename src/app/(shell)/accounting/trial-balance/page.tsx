import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getTrialBalancePageData } from "@/modules/accounting/actions/trial-balance.actions";
import { TrialBalancePage } from "@/modules/accounting/components/trial-balance-page";

interface TrialBalanceRouteProps {
  searchParams: Promise<{ from?: string; to?: string; storeId?: string }>;
}

export default async function TrialBalanceRoute({ searchParams }: TrialBalanceRouteProps) {
  try {
    const params = await searchParams;
    const data = await getTrialBalancePageData({
      from: params.from,
      to: params.to,
      storeId: params.storeId,
    });
    return <TrialBalancePage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية لميزان المراجعة"
          description="فعّل دفتر الأستاذ العام من الإعدادات، أو اطلب صلاحية العرض من المالك."
        />
      );
    }
    throw error;
  }
}
