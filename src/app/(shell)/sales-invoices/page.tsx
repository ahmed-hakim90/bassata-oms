import { Suspense } from "react";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { LoadingStateBlock } from "@/components/SweetFlow/state-blocks";
import { getSalesInvoicesData } from "@/modules/sales-invoices/actions/sales-invoice.actions";
import { SalesInvoicesPage } from "@/modules/sales-invoices/components/sales-invoices-page";

export default async function SalesInvoicesRoute() {
  const storeResult = await requirePageStoreId("/sales-invoices");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }

  try {
    const data = await getSalesInvoicesData();
    return (
      <Suspense fallback={<LoadingStateBlock label="جاري تحميل فواتير المبيعات…" />}>
        <SalesInvoicesPage {...data} />
      </Suspense>
    );
  } catch (e) {
    const message =
      e instanceof AuthError || e instanceof Error
        ? e.message
        : "مفيش صلاحية على فواتير المبيعات";
    return <AccessDenied title="فواتير المبيعات" description={message} />;
  }
}
