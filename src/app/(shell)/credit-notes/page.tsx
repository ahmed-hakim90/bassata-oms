import { Suspense } from "react";
import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { LoadingStateBlock } from "@/components/Velora/state-blocks";
import { getSalesInvoicesData } from "@/modules/sales-invoices/actions/sales-invoice.actions";
import { SalesInvoicesPage } from "@/modules/sales-invoices/components/sales-invoices-page";

export default async function CreditNotesRoute() {
  const storeResult = await requirePageStoreId("/credit-notes");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }

  try {
    const data = await getSalesInvoicesData("credit_note");
    return (
      <Suspense fallback={<LoadingStateBlock label="جاري تحميل الإشعارات الدائنة…" />}>
        <SalesInvoicesPage
          {...data}
          documentKind="credit_note"
          basePath="/credit-notes"
          title="إشعارات دائنة"
          description="أنشئ الإشعار من فاتورة مسلَّمة ثم أصدره ليرجع المخزون والرصيد"
          createLabel="إشعار دائن"
          allowCreate={false}
        />
      </Suspense>
    );
  } catch (e) {
    const message =
      e instanceof AuthError || e instanceof Error ? e.message : "مفيش صلاحية على الإشعارات الدائنة";
    return <AccessDenied title="إشعارات دائنة" description={message} />;
  }
}
