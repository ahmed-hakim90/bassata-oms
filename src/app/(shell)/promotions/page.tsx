import { getPromotionsPageData } from "@/modules/promotions/actions/promotion.actions";
import { PromotionsPage } from "@/modules/promotions/components/promotions-page";

export default async function PromotionsRoute() {
  const data = await getPromotionsPageData();
  return <PromotionsPage rules={data.rules} categories={data.categories} products={data.products} />;
}
