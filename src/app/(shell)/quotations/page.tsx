import { Suspense } from "react";
import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { LoadingStateBlock } from "@/components/Velora/state-blocks";
import { getSalesInvoicesData } from "@/modules/sales-invoices/actions/sales-invoice.actions";
import { SalesInvoicesPage } from "@/modules/sales-invoices/components/sales-invoices-page";

export default async function QuotationsRoute() {
  const storeResult = await requirePageStoreId("/quotations");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }

  try {
    const data = await getSalesInvoicesData("quotation");
    return (
      <Suspense fallback={<LoadingStateBlock label="جاري تحميل عروض الأسعار…" />}>
        <SalesInvoicesPage
          {...data}
          documentKind="quotation"
          basePath="/quotations"
          title="عروض الأسعار"
          description="مسودة → إرسال للعميل → تحويل لأمر بيع"
          createLabel="عرض سعر جديد"
        />
      </Suspense>
    );
  } catch (e) {
    const message =
      e instanceof AuthError || e instanceof Error ? e.message : "مفيش صلاحية على عروض الأسعار";
    return <AccessDenied title="عروض الأسعار" description={message} />;
  }
}
