import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getBalanceSheetPageData } from "@/modules/accounting/actions/balance-sheet.actions";
import { BalanceSheetPage } from "@/modules/accounting/components/balance-sheet-page";

interface BalanceSheetRouteProps {
  searchParams: Promise<{ asOf?: string; storeId?: string }>;
}

export default async function BalanceSheetRoute({
  searchParams,
}: BalanceSheetRouteProps) {
  try {
    const params = await searchParams;
    const data = await getBalanceSheetPageData({
      asOf: params.asOf,
      storeId: params.storeId,
    });
    return <BalanceSheetPage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية للميزانية العمومية"
          description="فعّل دفتر الأستاذ العام من الإعدادات، أو اطلب صلاحية العرض من المالك."
        />
      );
    }
    throw error;
  }
}
