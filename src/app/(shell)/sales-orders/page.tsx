import { Suspense } from "react";
import { AccessDenied } from "@/components/Velora/access-denied";
import { AuthError } from "@/lib/auth/auth-error";
import { requirePageStoreId } from "@/lib/auth/page-guard";
import { LoadingStateBlock } from "@/components/Velora/state-blocks";
import { getSalesInvoicesData } from "@/modules/sales-invoices/actions/sales-invoice.actions";
import { SalesInvoicesPage } from "@/modules/sales-invoices/components/sales-invoices-page";

export default async function SalesOrdersRoute() {
  const storeResult = await requirePageStoreId("/sales-orders");
  if (!storeResult.ok) {
    return (
      <AccessDenied title={storeResult.denial.title} description={storeResult.denial.description} />
    );
  }

  try {
    const data = await getSalesInvoicesData("sales_order");
    return (
      <Suspense fallback={<LoadingStateBlock label="جاري تحميل أوامر البيع…" />}>
        <SalesInvoicesPage
          {...data}
          documentKind="sales_order"
          basePath="/sales-orders"
          title="أوامر البيع"
          description="مسودة → تأكيد → تحويل لفاتورة مبيعات"
          createLabel="أمر بيع جديد"
        />
      </Suspense>
    );
  } catch (e) {
    const message =
      e instanceof AuthError || e instanceof Error ? e.message : "مفيش صلاحية على أوامر البيع";
    return <AccessDenied title="أوامر البيع" description={message} />;
  }
}
