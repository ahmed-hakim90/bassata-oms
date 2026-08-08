import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getChartOfAccountsData } from "@/modules/accounting/actions/gl-account.actions";
import { ChartOfAccountsPage } from "@/modules/accounting/components/chart-of-accounts-page";

export default async function AccountingRoute() {
  try {
    const data = await getChartOfAccountsData();
    return <ChartOfAccountsPage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية للحسابات"
          description="فعّل دفتر الأستاذ العام من الإعدادات، أو اطلب صلاحية العرض من المالك."
        />
      );
    }
    throw error;
  }
}
