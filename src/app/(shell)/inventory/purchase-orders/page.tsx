import { getPurchasesData } from "@/modules/purchases/actions/purchase.actions";
import { PurchasesPage } from "@/modules/purchases/components/purchases-page";

export default async function PurchaseOrdersRoute() {
  const data = await getPurchasesData("purchase_order");
  return (
    <PurchasesPage
      {...data}
      documentKind="purchase_order"
      basePath="/inventory/purchase-orders"
      title="أوامر التوريد"
      description="مسودة → إرسال → استلام جزئي بفواتير شراء متعددة"
      createLabel="أمر توريد جديد"
    />
  );
}
