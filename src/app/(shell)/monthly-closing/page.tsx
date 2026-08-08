import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getClosingData } from "@/modules/monthly-closing/actions/closing.actions";
import { ClosingPage } from "@/modules/monthly-closing/components/closing-page";

export default async function MonthlyClosingRoute() {
  try {
    const data = await getClosingData();
    return <ClosingPage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية للإقفال الشهري"
          description="فعّل خاصية الإقفال الشهري من الإعدادات، أو اطلب صلاحية الإقفال من المالك."
        />
      );
    }
    throw error;
  }
}
