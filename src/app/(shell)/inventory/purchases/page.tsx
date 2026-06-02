import { getPurchasesData } from "@/modules/purchases/actions/purchase.actions";
import { PurchasesPage } from "@/modules/purchases/components/purchases-page";

export default async function PurchasesRoute() {
  const data = await getPurchasesData();
  return <PurchasesPage {...data} />;
}
