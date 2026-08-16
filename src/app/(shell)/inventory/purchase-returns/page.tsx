import { getPurchasesData } from "@/modules/purchases/actions/purchase.actions";
import { PurchasesPage } from "@/modules/purchases/components/purchases-page";

export default async function PurchaseReturnsRoute() {
  const data = await getPurchasesData("purchase_return");
  return (
    <PurchasesPage
      {...data}
      documentKind="purchase_return"
      basePath="/inventory/purchase-returns"
      title="مرتجعات المشتريات"
      description="أنشئ المرتجع من فاتورة مستلمة ثم رحّله عشان ينزل المخزون ورصيد المورد"
      createLabel="مرتجع مشتريات"
      allowCreate={false}
    />
  );
}
