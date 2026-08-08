import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { getJournalsPageData } from "@/modules/accounting/actions/journal.actions";
import { JournalsPage } from "@/modules/accounting/components/journals-page";

export default async function AccountingJournalsRoute() {
  try {
    const data = await getJournalsPageData();
    return <JournalsPage {...data} />;
  } catch (error) {
    if (error instanceof AuthError) {
      return (
        <AccessDenied
          title="مفيش صلاحية للقيود اليومية"
          description="فعّل دفتر الأستاذ العام من الإعدادات، أو اطلب صلاحية العرض من المالك."
        />
      );
    }
    throw error;
  }
}
