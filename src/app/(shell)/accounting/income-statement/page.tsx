import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getIncomeStatementPageData } from "@/modules/accounting/actions/income-statement.actions";
import { IncomeStatementPage } from "@/modules/accounting/components/income-statement-page";

interface IncomeStatementRouteProps {
  searchParams: Promise<{ from?: string; to?: string; storeId?: string }>;
}

export default async function IncomeStatementRoute({
  searchParams,
}: IncomeStatementRouteProps) {
  try {
    const params = await searchParams;
    const data = await getIncomeStatementPageData({
      from: params.from,
      to: params.to,
      storeId: params.storeId,
    });
    return <IncomeStatementPage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية لقائمة الدخل"
          description="فعّل دفتر الأستاذ العام من الإعدادات، أو اطلب صلاحية العرض من المالك."
        />
      );
    }
    throw error;
  }
}
